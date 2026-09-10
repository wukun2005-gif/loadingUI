import { DEPTH_LABELS, type ThinkingDepth } from '../types/sse'

// F12 可调节思考深度：快速回答 / 标准 / 深度分析。
// 深度档对应更多步骤与更长预估时间（由 SSE mock 按 depth 编排，前端不伪造时长）。
interface Props {
  value: ThinkingDepth
  onChange: (d: ThinkingDepth) => void
  highlight?: boolean
  disabled?: boolean
}

const ORDER: ThinkingDepth[] = ['fast', 'standard', 'deep']
const HINT: Record<ThinkingDepth, string> = {
  fast: '步骤更少 · 预估时间更短',
  standard: '默认深度 · 6 个步骤',
  deep: '增加敏感性 / 风险权衡 · 预估更久',
}

export function DepthSwitch({ value, onChange, highlight, disabled }: Props) {
  return (
    <div className={`depth ${highlight ? 'demo-highlight' : ''}`} aria-label="思考深度（F12）">
      <div className="depth-head">
        <span className="depth-title">思考深度（F12）</span>
        <span className="depth-hint">{HINT[value]}</span>
      </div>
      <div className="depth-seg" role="tablist">
        {ORDER.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={value === d}
            data-depth={d}
            className={`depth-btn ${value === d ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(d)}
            title={HINT[d]}
          >
            {d === 'fast' ? '⚡' : d === 'deep' ? '🔬' : '◎'} {DEPTH_LABELS[d]}
          </button>
        ))}
      </div>
    </div>
  )
}
