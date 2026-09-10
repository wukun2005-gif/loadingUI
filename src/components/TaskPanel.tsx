import { deriveModel } from '../state/model'
import type { TaskRec } from '../sse/useThinkingTasks'

// F14 多任务并行进度面板：每个任务独立思考态、独立进度，可切换查看 / 关闭 / 完成后回放。
interface Props {
  tasks: TaskRec[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onReplay: (id: string) => void
  highlight?: boolean
  highlightAdd?: boolean
}

function taskPercent(t: TaskRec): number {
  if (t.done) return 100
  const m = deriveModel(t.events)
  return Math.round(m.progress?.percent ?? 0)
}

export function TaskPanel({ tasks, activeId, onSelect, onAdd, onRemove, onReplay, highlight, highlightAdd }: Props) {
  return (
    <div className={`taskpanel ${highlight ? 'demo-highlight' : ''}`}>
      <div className="taskpanel-head">
        <span>并行任务（F14）· 每个任务独立 SSE 流与思考态，可同时推进</span>
        <button
          className={`mini primary ${highlightAdd ? 'demo-highlight' : ''}`}
          data-task-add
          onClick={onAdd}
        >
          ＋ 新任务
        </button>
      </div>
      <div className="taskpanel-list">
        {tasks.map((t) => {
          const pct = taskPercent(t)
          const isActive = t.id === activeId
          return (
            <div
              key={t.id}
              className={`task-card ${isActive ? 'active' : ''} ${t.done ? 'done' : ''}`}
              data-task-id={t.id}
              onClick={() => onSelect(t.id)}
              role="button"
            >
              <div className="task-card-top">
                <span className="task-status-ico">
                  {t.done ? '✓' : t.connected ? <span className="task-spin" /> : '…'}
                </span>
                <span className="task-title" title={t.title}>{t.title}</span>
                <span className="task-pct">{pct}%</span>
                {tasks.length > 1 && (
                  <button
                    className="task-x"
                    title="关闭该任务"
                    onClick={(e) => { e.stopPropagation(); onRemove(t.id) }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="task-mini-track">
                <span className={t.done ? 'is-done' : ''} style={{ width: `${pct}%` }} />
              </div>
              <div className="task-card-foot">
                <span className="task-meta">
                  {t.done ? '已完成' : t.connected ? `思考中 · ${t.mode === 'full' ? '完整流' : t.mode === 'fallback2' ? '降级2' : '降级3'}` : '连接中…'}
                </span>
                {t.done && (
                  <button
                    className="task-replay"
                    data-replay-id={t.id}
                    onClick={(e) => { e.stopPropagation(); onReplay(t.id) }}
                  >
                    ⏪ 回放
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
