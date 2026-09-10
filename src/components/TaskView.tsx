import { useEffect, useMemo } from 'react'
import { Timeline } from './Timeline'
import { ReasoningFlow } from './ReasoningFlow'
import { EasedProgress } from './EasedProgress'
import { ContextChips } from './ContextChips'
import { KnowledgeTree } from './KnowledgeTree'
import { DepthSwitch } from './DepthSwitch'
import { ReasoningCanvas } from './ReasoningCanvas'
import { deriveModel } from '../state/model'
import { useSources, type SourcesApi } from '../state/useSources'
import type { SourceNode, ThinkingDepth } from '../types/sse'
import type { TaskRec } from '../sse/useThinkingTasks'

interface Props {
  task: TaskRec
  active: boolean
  /** 一键演示当前高亮 key（仅 active 任务生效） */
  hl?: string
  // —— 一键演示受控态 ——
  demoOpenId: string | null
  demoFakePicker: boolean
  collapseReasoning: boolean
  collapseTree: boolean
  onCollapseReasoning: (v: boolean) => void
  onCollapseTree: (v: boolean) => void
  onFakeOpen: () => void
  onDepthChange: (d: ThinkingDepth) => void
  onParticipate: (op: string) => void
  onReplay: (id: string) => void
  onExport: (id: string) => void
  registerSources: (id: string, api: SourcesApi | null) => void
  reportSources: (id: string, sources: SourceNode[]) => void
}

export function TaskView(props: Props) {
  const {
    task, active, hl, demoOpenId, demoFakePicker,
    collapseReasoning, collapseTree, onCollapseReasoning, onCollapseTree,
    onFakeOpen, onDepthChange, onParticipate, onReplay, onExport,
    registerSources, reportSources,
  } = props

  const model = useMemo(() => deriveModel(task.events), [task.events])
  const sourcesApi = useSources(task.events)

  // 向 App 暴露本任务的知识源 API（一键演示上传/新增用）与最新来源（回放导出用）
  useEffect(() => { registerSources(task.id, sourcesApi) }, [task.id, sourcesApi, registerSources])
  useEffect(() => { reportSources(task.id, sourcesApi.sources) }, [task.id, sourcesApi.sources, reportSources])

  const excludedIds = useMemo(
    () => new Set(sourcesApi.sources.filter((s) => s.status === 'excluded').map((s) => s.id)),
    [sourcesApi.sources]
  )

  return (
    <main className="stage-card" data-tier={model.tier} data-task-id={task.id}>
      <div className="stage-head">
        <span className="dot" />
        <span className="stage-title">{model.meta?.title ?? '正在思考…'}</span>
        <span className={`conn ${task.connected ? 'on' : task.done ? 'off' : 'off'}`}>
          {task.connected ? 'SSE 已连接' : task.done ? '已完成' : '连接中'}
        </span>
      </div>

      <DepthSwitch value={task.depth} onChange={onDepthChange} highlight={active && hl === 'depth'} />

      {model.tier === 1 && <Timeline steps={model.steps} currentStage={model.currentStage} highlight={active && hl === 'timeline'} />}

      <ReasoningFlow
        reasoning={model.reasoning}
        excludedIds={excludedIds}
        show={model.tier !== 3}
        highlight={active && hl === 'reasoning'}
        collapsed={collapseReasoning}
        onCollapsedChange={onCollapseReasoning}
      />

      <EasedProgress progress={model.progress} done={task.done} highlight={active && hl === 'progress'} />

      {model.chips.length > 0 && <ContextChips chips={model.chips} highlight={active && hl === 'chips'} />}

      {model.tier === 1 && (
        <ReasoningCanvas
          model={model}
          sources={sourcesApi.sources}
          highlight={active && hl === 'canvas'}
          collapsed={false}
        />
      )}

      {model.tier !== 3 && (
        <KnowledgeTree
          sources={sourcesApi.sources}
          touched={sourcesApi.touched}
          api={sourcesApi}
          highlight={active && hl === 'tree'}
          highlightAdd={active && hl === 'add'}
          openId={active ? demoOpenId : null}
          demoFakePicker={active && demoFakePicker}
          onFakeOpen={onFakeOpen}
          collapsed={collapseTree}
          onCollapsedChange={onCollapseTree}
          onParticipate={onParticipate}
        />
      )}

      {model.partial && (
        <div className="partial">
          <div className="partial-title">{model.partial.title ?? '阶段性结论'}</div>
          <div className="partial-body">{model.partial.content}</div>
        </div>
      )}

      {task.done && (
        <div className="done-block">
          <div className="done-banner">✓ 思考完成，结果已生成（Demo 终点）</div>
          <div className="done-actions">
            <button className="mini primary" data-replay-self onClick={() => onReplay(task.id)}>⏪ 回放思考过程（F15）</button>
            <button className="mini" data-export-self onClick={() => onExport(task.id)}>⤓ 导出可分享图文</button>
          </div>
        </div>
      )}
    </main>
  )
}
