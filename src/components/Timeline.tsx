import { STAGE_LABELS, STAGE_ORDER, type StageId } from '../types/sse'
import type { StepView } from '../state/model'

interface Props {
  steps: StepView[]
  currentStage?: StageId
  highlight?: boolean
}

export function Timeline({ steps, currentStage, highlight }: Props) {
  const curIdx = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1
  const total = steps[0]?.total ?? steps.length
  const doneCount = steps.filter((s) => s.status === 'done').length

  return (
    <div className={`timeline ${highlight ? 'demo-highlight' : ''}`} aria-label="思考阶段时间线">
      <div className="timeline-track">
        {STAGE_ORDER.map((st, i) => {
          const state = i < curIdx ? 'done' : i === curIdx ? 'active' : 'todo'
          return (
            <div key={st} className={`tl-node ${state}`}>
              <div className="tl-dot" />
              <div className="tl-label">{STAGE_LABELS[st]}</div>
            </div>
          )
        })}
      </div>
      <div className="timeline-sub">
        步骤进度 {doneCount}/{total || 0}
        {steps.find((s) => s.status === 'running') && (
          <span className="running-step"> · 进行中：{steps.find((s) => s.status === 'running')!.label}</span>
        )}
      </div>
    </div>
  )
}
