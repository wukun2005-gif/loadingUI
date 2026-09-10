import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STAGE_LABELS, STAGE_ORDER, type SourceNode, type StageId } from '../types/sse'
import type { Model } from '../state/model'

// F13 可视化推理画布：把推理过程映射为「问题 → 阶段 → 步骤 / 知识源 → 结论」的网络拓扑，
// 节点随 SSE 事件实时生长，连接线带流动动画；点节点看详情；SVG viewBox 自适应小屏。

interface Props {
  model: Model
  sources: SourceNode[]
  highlight?: boolean
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
}

type NodeKind = 'question' | 'stage' | 'step' | 'source' | 'conclusion'
interface GNode {
  id: string
  kind: NodeKind
  label: string
  x: number
  y: number
  w: number
  h: number
  stage?: StageId
  state?: 'todo' | 'active' | 'done'
}
interface GEdge { from: string; to: string; state?: 'todo' | 'active' | 'done' }

const W = 780
const COL_W = W / 4
const STAGE_Y = 118
const STEP_Y0 = 196
const STEP_DY = 58

export function ReasoningCanvas({ model, sources, highlight, collapsed: collapsedProp, onCollapsedChange }: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  // 详情面板渲染在 SVG 下方；选中节点后自动滚到可见处，避免「点了没反应」的错觉
  const detailRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selId])
  const collapsed = collapsedProp ?? internalCollapsed

  const { nodes, edges, height } = useMemo(() => {
    const curIdx = model.currentStage ? STAGE_ORDER.indexOf(model.currentStage) : -1
    const ns: GNode[] = []
    const es: GEdge[] = []

    const title = model.meta?.title ?? '当前任务'
    ns.push({ id: 'q', kind: 'question', label: title, x: W / 2 - 120, y: 14, w: 240, h: 38 })

    STAGE_ORDER.forEach((st, i) => {
      const x = COL_W * (i + 0.5) - 66
      const state: GNode['state'] = i < curIdx ? 'done' : i === curIdx ? 'active' : 'todo'
      const id = `stage-${st}`
      ns.push({ id, kind: 'stage', label: STAGE_LABELS[st], x, y: STAGE_Y, w: 132, h: 34, stage: st, state })
      es.push({ from: 'q', to: id, state: state === 'todo' ? 'todo' : 'done' })
    })

    // 步骤节点挂在所属阶段列下方
    const perStage = new Map<StageId, typeof model.steps>()
    for (const s of model.steps) {
      const arr = perStage.get(s.stage) ?? []
      arr.push(s)
      perStage.set(s.stage, arr)
    }
    let maxRows = 1
    perStage.forEach((arr, st) => {
      arr.forEach((s, k) => {
        maxRows = Math.max(maxRows, k + 1)
        const x = COL_W * (STAGE_ORDER.indexOf(st) + 0.5) - 78
        const y = STEP_Y0 + k * STEP_DY
        ns.push({
          id: `step-${s.id}`,
          kind: 'step',
          label: s.label,
          x, y, w: 156, h: 32,
          stage: st,
          state: s.status === 'done' ? 'done' : 'active',
        })
        es.push({ from: `stage-${st}`, to: `step-${s.id}`, state: s.status === 'done' ? 'done' : 'active' })
      })
    })

    const bottomY = STEP_Y0 + maxRows * STEP_DY + 34
    // 结论节点（先算，用于给知识源行预留右侧空间）
    const hasConclusion = !!model.partial || model.reasoning.some((r) => r.kind === 'conclusion')
    // 知识源节点挂在「检索知识源」阶段下（root 已由问题节点代表，不再重复画）
    const visibleSources = sources.filter((s) => s.parentId && s.status !== 'excluded').slice(0, 6)
    const excluded = sources.filter((s) => s.parentId && s.status === 'excluded').slice(0, 3)
    const allBottom = [...visibleSources, ...excluded]
    // 宽度按数量自适应，保证任何数量下都不重叠、不溢出；右侧为结论节点预留位置
    const srcAreaW = (hasConclusion ? W - 196 : W - 24)
    const srcW = allBottom.length > 0
      ? Math.min(140, Math.max(92, (srcAreaW - (allBottom.length - 1) * 10) / allBottom.length))
      : 132
    const srcGap = allBottom.length > 1 ? (srcAreaW - allBottom.length * srcW) / (allBottom.length - 1) : 0
    allBottom.forEach((s, i) => {
      const x = 12 + i * (srcW + srcGap)
      // 先去扩展名再截断，避免留下「文件名.…」
      const plain = s.title.replace(/\.(pdf|docx?|xlsx?|md|txt|png|jpe?g|webp)$/i, '')
      const label = plain.length > 12 ? plain.slice(0, 11) + '…' : plain
      ns.push({
        id: `src-${s.id}`,
        kind: 'source',
        label,
        x, y: bottomY + 44, w: srcW, h: 30,
        stage: 'retrieving',
        state: s.status === 'excluded' ? 'todo' : s.status === 'pending' ? 'active' : 'done',
      })
      es.push({ from: 'stage-retrieving', to: `src-${s.id}`, state: s.status === 'excluded' ? 'todo' : 'done' })
    })

    if (hasConclusion) {
      ns.push({
        id: 'conclusion',
        kind: 'conclusion',
        label: model.partial?.title ?? '对比结论',
        x: W - 172, y: bottomY + 44, w: 160, h: 32,
        stage: 'synthesizing',
        state: 'done',
      })
      es.push({ from: 'stage-synthesizing', to: 'conclusion', state: 'active' })
    }

    return { nodes: ns, edges: es, height: bottomY + 100 }
  }, [model, sources])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const selected = selId ? nodeById.get(selId) : null

  const toggle = () => {
    const next = !collapsed
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const edgePath = (e: GEdge): string => {
    const a = nodeById.get(e.from)
    const b = nodeById.get(e.to)
    if (!a || !b) return ''
    const x1 = a.x + a.w / 2
    const y1 = a.y + a.h
    const x2 = b.x + b.w / 2
    const y2 = b.y
    return `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
  }

  return (
    <div className={`canvas-panel ${highlight ? 'demo-highlight' : ''}`}>
      <div className="canvas-head">
        <span>推理画布（F13）· 推理拓扑实时生长 · 点任意节点，详情显示在画布下方</span>
        <button className="mini" onClick={toggle}>{collapsed ? '▾ 展开' : '▴ 收起'}</button>
      </div>
      {!collapsed && (
        <>
          <div className="canvas-scroll">
            <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="推理拓扑画布">
              {edges.map((e, i) => (
                <path
                  key={i}
                  className={`cedge ${e.state ?? 'todo'} ${e.state === 'active' ? 'flow' : ''}`}
                  d={edgePath(e)}
                  fill="none"
                />
              ))}
              {nodes.map((n) => (
                <g
                  key={n.id}
                  className={`cnode-g ${n.state ?? ''} ${selId === n.id ? 'sel' : ''}`}
                  data-canvas-node={n.id}
                  onClick={() => setSelId(selId === n.id ? null : n.id)}
                >
                  <rect className={`cnode cnode-${n.kind} ${n.state ?? ''}`} x={n.x} y={n.y} width={n.w} height={n.h} rx={9} />
                  <text className="cnode-text" x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle">
                    {n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          {selected && <div ref={detailRef}><CanvasDetail node={selected} model={model} sources={sources} /></div>}
        </>
      )}
    </div>
  )
}

function CanvasDetail({ node, model, sources }: { node: GNode; model: Model; sources: SourceNode[] }) {
  let body: ReactNode = null
  if (node.kind === 'question') {
    body = <span>本次思考的任务问题，所有阶段与证据都围绕它展开。</span>
  } else if (node.kind === 'stage') {
    body = (
      <span>
        阶段状态：{node.state === 'done' ? '已完成' : node.state === 'active' ? '进行中' : '待开始'} ·
        四阶段时间线（F1）与本画布同源，均由 SSE stage 事件驱动。
      </span>
    )
  } else if (node.kind === 'step') {
    const stepId = node.id.replace('step-', '')
    const snippets = model.reasoning.filter((r) => r.stepId === stepId)
    body = (
      <div className="cdetail-list">
        {snippets.length === 0 && <div className="cdetail-empty">该步骤的推理片段尚未到达…</div>}
        {snippets.map((r) => (
          <div key={r.id} className={`cdetail-item ${r.kind ?? 'thought'}`}>
            {r.kind === 'number' && <span className="rsn-tag">数字</span>}
            {r.kind === 'conclusion' && <span className="rsn-tag concl">结论</span>}
            {r.text}
          </div>
        ))}
      </div>
    )
  } else if (node.kind === 'source') {
    const s = sources.find((x) => `src-${x.id}` === node.id)
    body = s ? (
      <span>
        知识源「{s.title}」· 状态：{s.status === 'active' ? 'AI 正在使用' : s.status === 'pending' ? '待采纳（下一轮生效）' : '已排除'}
        {s.relevance != null && <> · 相关度 {Math.round(s.relevance * 100)}%</>}
        {s.summary && <> · {s.summary}</>}
      </span>
    ) : null
  } else if (node.kind === 'conclusion') {
    body = <span>{model.partial?.content ?? '关键结论将在综合阶段生成。'}</span>
  }
  return (
    <div className="canvas-detail" role="note">
      <div className="canvas-detail-title">🔹 {node.label}</div>
      <div className="canvas-detail-body">{body}</div>
    </div>
  )
}
