import type { DemoStep } from '../demo/demoScript'

interface Props {
  step: DemoStep
  index: number
  total: number
  paused: boolean
  onTogglePause: () => void
  onSkip: () => void
}

// 引导式解说面板：步骤计数 + 解说 + 进度条 + 暂停/跳过
export function DemoTour({ step, index, total, paused, onTogglePause, onSkip }: Props) {
  return (
    <div className="demo-tour" role="dialog" aria-label="一键演示引导">
      <div className="demo-tour-head">
        <span className="demo-tour-badge">🎬 一键演示{paused ? ' · 已暂停' : ''}</span>
        <span className="demo-tour-count">步骤 {index + 1} / {total}</span>
      </div>

      <div className="demo-tour-title">{step.title}</div>
      <div className="demo-tour-text">{step.text}</div>

      <div className="demo-progress" key={index}>
        <div
          className={`demo-progress-fill ${paused ? 'paused' : ''}`}
          style={{ animationDuration: `${step.duration}ms` }}
        />
      </div>

      <div className="demo-dots">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`demo-dot ${i === index ? 'on' : i < index ? 'done' : ''}`} />
        ))}
      </div>

      <div className="demo-tour-controls">
        <button className="mini primary" onClick={onTogglePause}>{paused ? '▶ 继续演示' : '⏸ 暂停演示'}</button>
        <button className="mini" onClick={onSkip}>⏭ 跳过演示</button>
      </div>
    </div>
  )
}
