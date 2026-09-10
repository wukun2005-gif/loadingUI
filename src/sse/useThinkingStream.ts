import { useCallback, useEffect, useRef, useState } from 'react'
import type { ThinkingEvent } from '../types/sse'

export interface StreamState {
  events: ThinkingEvent[]
  connected: boolean
  done: boolean
  /** 每次（重新）发起流时递增，供下游感知「新一轮开始」 */
  runId: number
  restart: () => void
}

/** 消费真实 SSE（/api/thinking-stream），不依赖 setTimeout 假数据。
 *  paused=true 时整段体验冻结：服务端事件进入缓冲区，恢复后一次性提交。 */
export function useThinkingStream(mode: string, speed = 1, paused = false): StreamState {
  const [events, setEvents] = useState<ThinkingEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [done, setDone] = useState(false)
  const [runId, setRunId] = useState(0)
  const esRef = useRef<EventSource | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const bufferRef = useRef<ThinkingEvent[]>([])

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return
    const batch = bufferRef.current
    bufferRef.current = []
    setEvents((prev) => [...prev, ...batch])
    if (batch.some((e) => e.type === 'done')) {
      setDone(true)
      setConnected(false)
    }
  }, [])

  const start = useCallback(() => {
    setRunId((n) => n + 1)
    setEvents([])
    setDone(false)
    setConnected(false)
    bufferRef.current = []
    esRef.current?.close()
    const es = new EventSource(`/api/thinking-stream?mode=${encodeURIComponent(mode)}&speed=${encodeURIComponent(String(speed))}`)
    esRef.current = es
    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as ThinkingEvent
        if (ev.type === 'done') {
          if (pausedRef.current) {
            bufferRef.current.push(ev)
            return
          }
          setDone(true)
          setConnected(false)
          es.close()
          return
        }
        if (pausedRef.current) {
          bufferRef.current.push(ev)
          return
        }
        setEvents((prev) => [...prev, ev])
      } catch {
        /* ignore malformed */
      }
    }
    es.onerror = () => setConnected(false)
  }, [mode, speed])

  // 恢复时把暂停期间缓冲的事件一次性提交
  useEffect(() => {
    if (!paused) flush()
  }, [paused, flush])

  useEffect(() => {
    start()
    return () => esRef.current?.close()
  }, [start])

  return { events, connected, done, runId, restart: start }
}
