import { useEasedProgress, usePrefersReducedMotion } from '../sse/useEasedProgress'

interface Props {
  progress?: { percent: number; etaMs?: number; basis: string }
  done: boolean
  highlight?: boolean
}

function fmtEta(ms?: number): string {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s <= 0) return '即将完成'
  if (s < 60) return `约 ${s} 秒`
  return `约 ${Math.round(s / 60)} 分 ${s % 60} 秒`
}

export function EasedProgress({ progress, done, highlight }: Props) {
  const reduced = usePrefersReducedMotion()
  const target = done ? 100 : progress?.percent ?? 0
  const display = useEasedProgress(target, { reduced })
  const pct = Math.round(display)

  return (
    <div className={`progress ${highlight ? 'demo-highlight' : ''}`} aria-label="缓动进度">
      <div className="progress-row">
        <span className="progress-pct">{pct}%</span>
        <span className="progress-eta">预估剩余 {fmtEta(progress?.etaMs)}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${display}%` }} />
      </div>
      <div className="progress-note">
        缓动仅视觉 · 真实百分比由 SSE 事件驱动（basis: {progress?.basis ?? '—'}）
      </div>
    </div>
  )
}
