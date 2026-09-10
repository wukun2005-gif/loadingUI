import { useEffect, useMemo, useRef, useState } from 'react'
import { Timeline } from './Timeline'
import { ReasoningFlow } from './ReasoningFlow'
import { EasedProgress } from './EasedProgress'
import { deriveModel } from '../state/model'
import { exportThinkingReport } from '../state/exportReport'
import type { SourceNode } from '../types/sse'
import type { TaskRec } from '../sse/useThinkingTasks'

// F15 思考过程回放：任务完成后按原始事件间隔重放完整思考过程；支持暂停 / 快进（1×/2×/4×）/
// 拖动进度条，并可导出为可分享的图文 HTML。
interface Props {
  task: TaskRec
  sources: SourceNode[]
  onClose: () => void
}

const SPEEDS = [1, 2, 4] as const

export function ReplayModal({ task, sources, onClose }: Props) {
  const events = task.events
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<number>(1)
  const timer = useRef<number>(0)

  // 相邻事件的真实服务端间隔（截断极端值），回放节奏忠实于原始过程
  const delays = useMemo(() => {
    const arr = [240]
    for (let i = 1; i < events.length; i++) {
      const dt = events[i].ts - events[i - 1].ts
      arr.push(Math.min(1200, Math.max(30, Number.isFinite(dt) ? dt : 300)))
    }
    return arr
  }, [events])

  const atEnd = cursor >= events.length - 1

  useEffect(() => {
    if (!playing || atEnd) {
      if (atEnd) setPlaying(false)
      return
    }
    timer.current = window.setTimeout(() => setCursor((c) => Math.min(events.length - 1, c + 1)), delays[cursor + 1] / speed)
    return () => window.clearTimeout(timer.current)
  }, [playing, cursor, speed, atEnd, delays, events.length])

  const slice = useMemo(() => deriveModel(events.slice(0, cursor + 1)), [events, cursor])
  const excludedIds = useMemo(
    () => new Set(sources.filter((s) => s.status === 'excluded').map((s) => s.id)),
    [sources]
  )

  const restart = () => { setCursor(0); setPlaying(true) }

  return (
    <div className="replay-overlay" role="dialog" aria-modal="true" aria-label="思考过程回放">
      <div className="replay-box">
        <div className="replay-head">
          <div className="replay-title">⏪ 思考过程回放（F15）· {task.title}</div>
          <button className="mini icon" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <div className="replay-stage">
          {slice.tier === 1 && <Timeline steps={slice.steps} currentStage={slice.currentStage} />}
          <ReasoningFlow reasoning={slice.reasoning} excludedIds={excludedIds} show={slice.tier !== 3} />
          <EasedProgress progress={slice.progress} done={atEnd} />
          {slice.chips.length > 0 && (
            <div className="chips">
              {slice.chips.map((c) => <span key={c.id} className={`chip ${c.tone ?? 'neutral'}`}>{c.label}</span>)}
            </div>
          )}
          {slice.partial && (
            <div className="partial">
              <div className="partial-title">{slice.partial.title ?? '阶段性结论'}</div>
              <div className="partial-body">{slice.partial.content}</div>
            </div>
          )}
        </div>

        <div className="replay-scrub">
          <input
            type="range"
            min={0}
            max={events.length - 1}
            value={cursor}
            onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)) }}
            aria-label="回放进度"
          />
          <span className="replay-count">事件 {cursor + 1} / {events.length}</span>
        </div>

        <div className="replay-controls">
          <button className="mini primary" onClick={() => (atEnd ? restart() : setPlaying((p) => !p))}>
            {atEnd ? '⟲ 重新回放' : playing ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button className="mini" onClick={restart}>⟲ 从头</button>
          <span className="replay-speeds">
            快进
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`mini ${speed === s ? 'primary' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </span>
          <span className="replay-spacer" />
          <button className="mini" onClick={() => exportThinkingReport(task, sources)}>⤓ 导出可分享图文</button>
        </div>
        <div className="replay-note">回放按原始 SSE 事件间隔重放（快进只压缩间隔，不跳过任何事件）；导出为自包含 HTML，可直接发给他人查看。</div>
      </div>
    </div>
  )
}
