import { useEffect, useState } from 'react'
import { getCounts, onMetricsChange, resetMetrics, type MetricEvent, type Variant } from '../analytics/metrics'

const LABELS: Record<MetricEvent, string> = {
  thinking_abandon: '任务放弃（取消 / 紧急停止）',
  reasoning_expand: '推理流展开',
  reasoning_collapse: '推理流收起',
  source_operation: '知识源操作（CRUD）',
  mode_switch: '模式切换',
  stage_reached: '阶段到达',
  partial_view: '阶段结论查看',
  complete: '思考完成',
  depth_switch: 'F12 思考深度切换',
  task_add: 'F14 新增并行任务',
  task_switch: 'F14 切换任务',
  replay_open: 'F15 打开回放',
  report_export: 'F15 导出图文',
  sound_toggle: 'F16 音效开关',
}

const ORDER: MetricEvent[] = [
  'thinking_abandon',
  'source_operation',
  'reasoning_expand',
  'reasoning_collapse',
  'mode_switch',
  'depth_switch',
  'task_add',
  'task_switch',
  'replay_open',
  'report_export',
  'sound_toggle',
  'partial_view',
  'complete',
]

interface Props {
  variant: Variant
  onClose: () => void
}

export function MetricsPanel({ variant, onClose }: Props) {
  const [counts, setCounts] = useState(getCounts())

  useEffect(() => onMetricsChange(() => setCounts(getCounts())), [])

  const total = ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0)
  const abandon = counts.thinking_abandon ?? 0
  const ops = counts.source_operation ?? 0
  const expand = counts.reasoning_expand ?? 0
  const abandonRate = total > 0 ? ((abandon / total) * 100).toFixed(1) : '0.0'
  const opRate = total > 0 ? ((ops / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="metrics-panel" role="dialog" aria-label="本地度量面板">
      <div className="metrics-head">
        <span>📊 本地度量 · A/B: <b>{variant}</b></span>
        <button className="mini" onClick={onClose}>✕</button>
      </div>
      <div className="metrics-kpis">
        <div><span className="kpi-num">{abandonRate}%</span><span className="kpi-lbl">放弃率</span></div>
        <div><span className="kpi-num">{opRate}%</span><span className="kpi-lbl">操作率</span></div>
        <div><span className="kpi-num">{expand}</span><span className="kpi-lbl">展开次数</span></div>
      </div>
      <table className="metrics-table">
        <tbody>
          {ORDER.map((k) => (
            <tr key={k}>
              <td>{LABELS[k]}</td>
              <td className="metrics-val">{counts[k] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="mini" onClick={resetMetrics}>重置计数</button>
      <div className="metrics-note">本地 sink（localStorage）。真实管线接入点见 src/analytics/metrics.ts。</div>
    </div>
  )
}
