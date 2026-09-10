import { STAGE_ORDER, type MetaEvent, type StageId, type ThinkingEvent } from '../types/sse'

export interface StepView {
  id: string
  label: string
  stage: StageId
  index: number
  total?: number
  estimatedMs?: number
  status: 'running' | 'done'
}

export interface ReasoningView {
  id: string
  text: string
  kind?: 'thought' | 'number' | 'conclusion'
  stepId?: string
}

export interface Model {
  meta?: MetaEvent
  currentStage?: StageId
  steps: StepView[]
  reasoning: ReasoningView[]
  progress?: { percent: number; etaMs?: number; basis: string }
  partial?: { title?: string; content: string }
  chips: { id: string; label: string; tone?: string }[]
  tier: 1 | 2 | 3
  hasReasoning: boolean
}

/** 把一段 SSE 事件序列（可能是完整流，也可能是回放中的切片）归约为视图模型。纯函数。 */
export function deriveModel(events: ThinkingEvent[]): Model {
  let meta: MetaEvent | undefined
  let currentStage: StageId | undefined
  const steps = new Map<string, StepView>()
  const reasoning: ReasoningView[] = []
  const chips: Model['chips'] = []
  let progress: Model['progress']
  let partial: Model['partial']
  let rid = 0

  for (const e of events) {
    switch (e.type) {
      case 'meta':
        meta = e
        break
      case 'stage':
        currentStage = e.stage
        break
      case 'step_started':
        steps.set(e.stepId, {
          id: e.stepId, label: e.label, stage: e.stage, index: e.index,
          total: e.total, estimatedMs: e.estimatedMs, status: 'running',
        })
        break
      case 'step_completed':
        if (steps.has(e.stepId)) steps.get(e.stepId)!.status = 'done'
        break
      case 'reasoning_snippet':
        reasoning.push({ id: `r${rid++}`, text: e.text, kind: e.kind, stepId: e.stepId })
        break
      case 'progress_update':
        progress = { percent: e.percent, etaMs: e.etaMs, basis: e.basis }
        break
      case 'partial_result':
        partial = { title: e.title, content: e.content }
        break
      case 'context_chip':
        if (!chips.find((c) => c.id === e.id)) chips.push({ id: e.id, label: e.label, tone: e.tone })
        break
    }
  }

  const stepList = STAGE_ORDER.flatMap((st) =>
    [...steps.values()].filter((s) => s.stage === st)
  )
  const hasSteps = stepList.length > 0
  const hasReasoning = reasoning.length > 0

  let tier: 1 | 2 | 3 = 1
  if (meta?.scenario === 'fallback3') tier = 3
  else if (meta?.scenario === 'fallback2') tier = 2
  else if (!hasSteps && hasReasoning) tier = 2
  else if (!hasSteps && !hasReasoning) tier = 3

  return { meta, currentStage, steps: stepList, reasoning, progress, partial, chips, tier, hasReasoning }
}
