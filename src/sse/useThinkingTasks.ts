import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScenarioMode, ThinkingDepth, ThinkingEvent } from '../types/sse'

/** 与 vite.config mock 的 QUESTION_TITLES 同序（多任务用不同问题区分） */
export const QUESTION_PRESETS = [
  '对比三家竞品的季度营收与增长策略',
  '评估海外市场进入策略（欧盟 / 东南亚）',
  '复盘上季度投放 ROI 并给出下季度预算建议',
  '对比三种云方案的三年总体拥有成本（TCO）',
]

export interface TaskRec {
  id: string
  title: string
  qIdx: number
  mode: ScenarioMode
  depth: ThinkingDepth
  speed: number
  events: ThinkingEvent[]
  connected: boolean
  done: boolean
  startedAt: number
}

export interface TaskParams {
  mode?: ScenarioMode
  depth?: ThinkingDepth
  speed?: number
  title?: string
}

let taskSeq = 0
const nextTaskId = () => `task_${Date.now().toString(36)}_${taskSeq++}`

export interface TasksApi {
  tasks: TaskRec[]
  activeId: string
  setActiveId: (id: string) => void
  active: TaskRec | undefined
  addTask: (params?: TaskParams) => string
  removeTask: (id: string) => void
  restart: (id: string) => void
  updateParams: (id: string, patch: TaskParams) => void
  /** 一键演示开始时复位：只保留主任务并重置其全部参数 */
  resetAll: (params?: TaskParams) => void
}

/**
 * F14 多任务并行：每个任务持有独立 EventSource 与事件序列，可同时推进、互不影响。
 * paused=true（一键演示暂停）时所有任务的服务端事件进入各自缓冲区，恢复后一次性提交。
 */
export function useThinkingTasks(paused = false): TasksApi {
  const [tasks, setTasks] = useState<TaskRec[]>([])
  const [activeId, setActiveId] = useState('main')
  const tasksRef = useRef<TaskRec[]>([])
  tasksRef.current = tasks
  const esMap = useRef(new Map<string, EventSource>())
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const buffers = useRef(new Map<string, ThinkingEvent[]>())

  const closeEs = useCallback((id: string) => {
    esMap.current.get(id)?.close()
    esMap.current.delete(id)
  }, [])

  const connect = useCallback((id: string, mode: ScenarioMode, depth: ThinkingDepth, speed: number, qIdx: number) => {
    closeEs(id)
    const url =
      `/api/thinking-stream?mode=${encodeURIComponent(mode)}` +
      `&speed=${encodeURIComponent(String(speed))}` +
      `&depth=${encodeURIComponent(depth)}` +
      `&q=${qIdx}`
    const es = new EventSource(url)
    esMap.current.set(id, es)
    es.onopen = () => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, connected: true } : t)))
    es.onmessage = (e) => {
      let ev: ThinkingEvent | null = null
      try { ev = JSON.parse(e.data) as ThinkingEvent } catch { return }
      if (pausedRef.current) {
        const buf = buffers.current.get(id) ?? []
        buf.push(ev)
        buffers.current.set(id, buf)
        return
      }
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          if (ev!.type === 'done') return { ...t, events: [...t.events, ev!], done: true, connected: false }
          return { ...t, events: [...t.events, ev!] }
        })
      )
      if (ev.type === 'done') {
        es.close()
        esMap.current.delete(id)
      }
    }
    es.onerror = () => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, connected: false } : t)))
  }, [closeEs])

  const addTask = useCallback((params?: TaskParams): string => {
    const id = nextTaskId()
    const qIdx = tasksRef.current.length
    const rec: TaskRec = {
      id,
      title: params?.title ?? QUESTION_PRESETS[qIdx % QUESTION_PRESETS.length],
      qIdx,
      mode: params?.mode ?? 'full',
      depth: params?.depth ?? 'standard',
      speed: params?.speed ?? 1,
      events: [],
      connected: false,
      done: false,
      startedAt: Date.now(),
    }
    setTasks((prev) => [...prev, rec])
    connect(id, rec.mode, rec.depth, rec.speed, qIdx)
    return id
  }, [connect])

  const removeTask = useCallback((id: string) => {
    closeEs(id)
    buffers.current.delete(id)
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      return next
    })
  }, [closeEs])

  const restart = useCallback((id: string) => {
    const t = tasksRef.current.find((x) => x.id === id)
    if (!t) return
    buffers.current.set(id, [])
    connect(id, t.mode, t.depth, t.speed, t.qIdx)
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, events: [], done: false, connected: false, startedAt: Date.now() } : x)))
  }, [connect])

  const updateParams = useCallback((id: string, patch: TaskParams) => {
    const t = tasksRef.current.find((x) => x.id === id)
    if (!t) return
    buffers.current.set(id, [])
    const mode = patch.mode ?? t.mode
    const depth = patch.depth ?? t.depth
    const speed = patch.speed ?? t.speed
    connect(id, mode, depth, speed, t.qIdx)
    setTasks((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, ...patch, mode, depth, speed, events: [], done: false, connected: false, startedAt: Date.now() } : x
      )
    )
  }, [connect])

  const resetAll = useCallback((params?: TaskParams) => {
    for (const id of [...esMap.current.keys()]) closeEs(id)
    buffers.current.clear()
    const main: TaskRec = {
      id: 'main',
      title: QUESTION_PRESETS[0],
      qIdx: 0,
      mode: params?.mode ?? 'full',
      depth: params?.depth ?? 'standard',
      speed: params?.speed ?? 1,
      events: [],
      connected: false,
      done: false,
      startedAt: Date.now(),
    }
    setTasks([main])
    setActiveId('main')
    connect('main', main.mode, main.depth, main.speed, 0)
  }, [closeEs, connect])

  // 初始挂载：建立主任务
  useEffect(() => {
    resetAll()
    return () => {
      for (const id of [...esMap.current.keys()]) closeEs(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 暂停恢复：把缓冲事件一次性提交
  useEffect(() => {
    if (paused) return
    const snapshot = new Map(buffers.current)
    buffers.current.clear()
    if (snapshot.size === 0) return
    setTasks((prev) =>
      prev.map((t) => {
        const buf = snapshot.get(t.id)
        if (!buf || buf.length === 0) return t
        const isDone = buf.some((e) => e.type === 'done')
        return { ...t, events: [...t.events, ...buf], done: t.done || isDone, connected: !isDone }
      })
    )
  }, [paused])

  const active = tasks.find((t) => t.id === activeId) ?? tasks[0]

  return { tasks, activeId, setActiveId, active, addTask, removeTask, restart, updateParams, resetAll }
}
