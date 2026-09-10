import { useCallback, useEffect, useRef, useState } from 'react'
import type { SourceNode, SourceType, ThinkingEvent } from '../types/sse'
import { DEFAULT_SOURCES } from '../mock/defaultSources'

let uid = 0
const newId = () => `u${Date.now().toString(36)}_${uid++}`

async function ackCrud(op: string, source: SourceNode) {
  try {
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, source }),
    })
  } catch {
    /* Demo: 忽略网络错误 */
  }
}

export interface SourcesApi {
  sources: SourceNode[]
  /** 用户已操作（排除/新增/编辑）的来源 id，用于推理流提示「已排除/下一轮采纳」 */
  touched: Set<string>
  add: (title: string, type: SourceType, parentId?: string | null, extra?: { content?: string; preview?: string }) => SourceNode
  exclude: (id: string) => void
  include: (id: string) => void
  remove: (id: string) => void
  edit: (id: string, patch: Partial<SourceNode>) => void
  /** 复位为默认知识源树（一键演示每次开始时调用，避免重复跑累积上传节点） */
  reset: () => void
}

/** 知识源树状态：流式 seed + 用户 CRUD（走「下一轮生效」安全分支）。 */
export function useSources(events: ThinkingEvent[]): SourcesApi {
  const [sources, setSources] = useState<SourceNode[]>([])
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const seeded = useRef<Set<string>>(new Set())

  // 兜底：静态部署（无 /api/thinking-stream，SSE 不可用）时播种默认来源，
  // 保证知识源树与阅读器在纯静态环境下也可演示。
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSources((prev) => (prev.length === 0 ? DEFAULT_SOURCES : prev))
    }, 1200)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    for (const e of events) {
      if (e.type !== 'source') continue
      if (e.op === 'upsert') {
        if (seeded.current.has(e.source.id)) continue // 不覆盖用户后续编辑
        seeded.current.add(e.source.id)
        setSources((prev) => {
          const i = prev.findIndex((s) => s.id === e.source.id)
          if (i >= 0) {
            const next = prev.slice()
            next[i] = e.source
            return next
          }
          return [...prev, e.source]
        })
      } else if (e.op === 'remove') {
        setSources((prev) => prev.filter((s) => s.id !== e.source.id))
      } else if (e.op === 'exclude') {
        setSources((prev) => prev.map((s) => (s.id === e.source.id ? { ...s, status: 'excluded' } : s)))
      } else if (e.op === 'include') {
        setSources((prev) => prev.map((s) => (s.id === e.source.id ? { ...s, status: 'active' } : s)))
      }
    }
  }, [events])

  const add = useCallback((title: string, type: SourceType, parentId: string | null = 'root', extra?: { content?: string; preview?: string }): SourceNode => {
    const node: SourceNode = {
      id: newId(),
      title: title || '未命名来源',
      type,
      status: 'pending', // 下一轮生效
      relevance: 0.5,
      parentId,
      summary: '用户实时添加，将于下一轮生成中采纳',
      content: extra?.content ?? '用户实时添加的来源。\n\n（该来源将在下一轮生成中由 AI 实际读取与采纳；此处展示占位内容。）',
      preview: extra?.preview,
    }
    setSources((prev) => [...prev, node])
    setTouched((s) => new Set(s).add(node.id))
    ackCrud('upsert', node)
    return node
  }, [])

  const exclude = useCallback((id: string) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'excluded' } : s)))
    setTouched((s) => new Set(s).add(id))
    const node = sources.find((s) => s.id === id)
    if (node) ackCrud('exclude', { ...node, status: 'excluded' })
  }, [sources])

  const include = useCallback((id: string) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'active' } : s)))
    setTouched((s) => new Set(s).add(id))
    const node = sources.find((s) => s.id === id)
    if (node) ackCrud('include', { ...node, status: 'active' })
  }, [sources])

  const remove = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id && s.parentId !== id))
    const node = sources.find((s) => s.id === id)
    if (node) ackCrud('remove', node)
  }, [sources])

  const edit = useCallback((id: string, patch: Partial<SourceNode>) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    setTouched((s) => new Set(s).add(id))
    const node = sources.find((s) => s.id === id)
    if (node) ackCrud('upsert', { ...node, ...patch })
  }, [sources])

  const reset = useCallback(() => {
    seeded.current = new Set()
    setTouched(new Set())
    setSources(DEFAULT_SOURCES.map((s) => ({ ...s })))
  }, [])

  return { sources, touched, add, exclude, include, remove, edit, reset }
}
