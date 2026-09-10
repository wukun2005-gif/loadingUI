// PRD §技术方案(SSE) — 事件契约（单一真相源，前端与后端共用）
// 七类核心事件 + source(CRUD) + stage(时间线) + done(结束)

export type StageId = 'retrieving' | 'analyzing' | 'synthesizing' | 'finalizing'
export type ScenarioMode = 'full' | 'fallback2' | 'fallback3'
/** F12 可调节思考深度：快速回答 / 标准 / 深度分析（深度档步骤更多、预估时间更长） */
export type ThinkingDepth = 'fast' | 'standard' | 'deep'

export const DEPTH_LABELS: Record<ThinkingDepth, string> = {
  fast: '快速回答',
  standard: '标准',
  deep: '深度分析',
}

export interface BaseEvent {
  type: string
  ts: number // 服务端 epoch ms
  seq: number
}

export interface MetaEvent extends BaseEvent {
  type: 'meta'
  stages: StageId[]
  scenario: ScenarioMode
  title?: string
}

export interface StageEvent extends BaseEvent {
  type: 'stage'
  stage: StageId
  label: string
}

export interface StepStartedEvent extends BaseEvent {
  type: 'step_started'
  stepId: string
  label: string
  stage: StageId
  index: number
  total?: number
  estimatedMs?: number
}

export interface StepCompletedEvent extends BaseEvent {
  type: 'step_completed'
  stepId: string
  resultSummary?: string
  durationMs?: number
}

export interface ReasoningSnippetEvent extends BaseEvent {
  type: 'reasoning_snippet'
  stepId?: string
  text: string
  kind?: 'thought' | 'number' | 'conclusion'
}

export interface PartialResultEvent extends BaseEvent {
  type: 'partial_result'
  title?: string
  content: string
}

export interface ProgressUpdateEvent extends BaseEvent {
  type: 'progress_update'
  percent: number // 0..100 真实百分比（事件驱动）
  etaMs?: number
  basis: 'steps' | 'tokens' | 'heuristic'
}

export interface ContextChipEvent extends BaseEvent {
  type: 'context_chip'
  id: string
  label: string
  tone?: 'neutral' | 'info' | 'warn'
}

export type SourceStatus = 'active' | 'excluded' | 'pending'
export type SourceType = 'doc' | 'url' | 'user'

export interface SourceNode {
  id: string
  title: string
  type: SourceType
  status: SourceStatus
  relevance?: number
  parentId?: string | null
  summary?: string
  /** 全文内容，供用户点击节点后「打开阅读」 */
  content?: string
  /** 图片来源的内联预览（dataURL），如上传的图片 */
  preview?: string
}

export interface SourceEvent extends BaseEvent {
  type: 'source'
  op: 'upsert' | 'remove' | 'exclude' | 'include'
  source: SourceNode
}

export interface ErrorEvent extends BaseEvent {
  type: 'error'
  code: string
  message: string
  recoverable?: boolean
}

export interface DoneEvent extends BaseEvent {
  type: 'done'
  answerId?: string
}

export type ThinkingEvent =
  | MetaEvent
  | StageEvent
  | StepStartedEvent
  | StepCompletedEvent
  | ReasoningSnippetEvent
  | PartialResultEvent
  | ProgressUpdateEvent
  | ContextChipEvent
  | SourceEvent
  | ErrorEvent
  | DoneEvent

export const STAGE_LABELS: Record<StageId, string> = {
  retrieving: '检索知识源',
  analyzing: '分析证据',
  synthesizing: '综合结论',
  finalizing: '收尾排版',
}

export const STAGE_ORDER: StageId[] = ['retrieving', 'analyzing', 'synthesizing', 'finalizing']
