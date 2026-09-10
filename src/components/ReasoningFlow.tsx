import { useEffect, useRef, useState } from 'react'
import type { ReasoningView } from '../state/model'
import { track } from '../analytics/metrics'

interface Props {
  reasoning: ReasoningView[]
  excludedIds: Set<string>
  show: boolean
  highlight?: boolean
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
}

export function ReasoningFlow({ reasoning, excludedIds, show, highlight, collapsed: collapsedProp, onCollapsedChange }: Props) {
  const [paused, setPaused] = useState(false)
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = collapsedProp ?? internalCollapsed
  const ref = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (pausedRef.current) return
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [reasoning])

  if (!show) return null

  const toggleCollapse = () => {
    const next = !collapsed
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
    track(next ? 'reasoning_collapse' : 'reasoning_expand')
  }

  return (
    <div className={`reasoning ${highlight ? 'demo-highlight' : ''}`}>
      <div className="reasoning-head">
        <span>实时推理流</span>
        <span>
          <button className="mini" onClick={toggleCollapse}>{collapsed ? '▾ 展开' : '▴ 收起'}</button>
          <button className="mini" title="仅暂停推理流自动滚屏，不暂停演示" onClick={() => setPaused((p) => !p)}>
            {paused ? '▶ 滚屏' : '⏸ 滚屏'}
          </button>
        </span>
      </div>
      {!collapsed && (
        <>
          {excludedIds.size > 0 && (
            <div className="excluded-note">已排除 {excludedIds.size} 个来源，后续推理将忽略这些来源。</div>
          )}
          <div className="reasoning-body" ref={ref}>
            {reasoning.length === 0 && <div className="reasoning-empty">（等待推理信号…）</div>}
            {reasoning.map((r) => (
              <div key={r.id} className={`rsn ${r.kind ?? 'thought'}`}>
                {r.kind === 'number' && <span className="rsn-tag">数字</span>}
                {r.kind === 'conclusion' && <span className="rsn-tag concl">结论</span>}
                <span className="rsn-text">{r.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
