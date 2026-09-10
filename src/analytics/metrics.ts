// 本地度量层（dev-plan 任务 2/11 的埋点注册与 A/B 分组）。
// 当前为本地 sink（localStorage + console），满足「埋点事件已注册、可上报」；
// 真实管线接入点：在 track() 内将事件上报到分析系统 / 采集服务（WS4 负责）。

export type MetricEvent =
  | 'thinking_abandon' // 用户取消 / 紧急停止（放弃率分子）
  | 'reasoning_expand' // 展开推理流
  | 'reasoning_collapse' // 收起推理流
  | 'source_operation' // 知识源 CRUD（操作率分子）
  | 'mode_switch' // 顶栏模式切换
  | 'stage_reached' // 到达新阶段
  | 'partial_view' // 查看阶段结论
  | 'complete' // 思考完成
  | 'depth_switch' // F12 切换思考深度
  | 'task_add' // F14 新增并行任务
  | 'task_switch' // F14 切换查看任务
  | 'replay_open' // F15 打开回放
  | 'report_export' // F15 导出图文
  | 'sound_toggle' // F16 开关音效

export interface MetricProps {
  [k: string]: string | number | boolean
}

const STORE_KEY = 'synthesis_metrics_v1'
const AB_KEY = 'synthesis_ab_variant'

function loadCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

let counts: Record<string, number> = loadCounts()
const listeners = new Set<() => void>()

export function track(event: MetricEvent, props: MetricProps = {}): void {
  counts[event] = (counts[event] ?? 0) + 1
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(counts))
  } catch {
    /* 忽略存储异常 */
  }
  // 真实管线接入点（WS4）：此处应上报到分析系统。
  console.debug('[metric]', event, props)
  listeners.forEach((l) => l())
}

export function getCounts(): Record<string, number> {
  return { ...counts }
}

export function onMetricsChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function resetMetrics(): void {
  counts = {}
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* 忽略 */
  }
  listeners.forEach((l) => l())
}

export type Variant = 'control' | 'exp'

/** A/B 分桶：?ab=control|exp 可强制覆盖；否则随机分配并持久化到 sessionStorage。 */
export function getVariant(): Variant {
  try {
    const url = new URLSearchParams(window.location.search).get('ab')
    if (url === 'control' || url === 'exp') return url
    const stored = sessionStorage.getItem(AB_KEY)
    if (stored === 'control' || stored === 'exp') return stored
    const v: Variant = Math.random() < 0.5 ? 'control' : 'exp'
    sessionStorage.setItem(AB_KEY, v)
    return v
  } catch {
    return 'exp'
  }
}
