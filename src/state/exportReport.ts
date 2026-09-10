import type { SourceNode } from '../types/sse'
import { STAGE_LABELS } from '../types/sse'
import type { TaskRec } from '../sse/useThinkingTasks'
import { deriveModel } from './model'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function pad(n: number): string { return String(n).padStart(2, '0') }
function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * F15：把一次完整思考过程导出为自包含、可分享的图文 HTML（内联样式，无外部依赖）。
 */
export function exportThinkingReport(task: TaskRec, sources: SourceNode[]): void {
  const m = deriveModel(task.events)
  const stageLine = STAGE_ORDER_FN(m.currentStage)
  const stepsHtml = m.steps
    .map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(s.label)}</td>
        <td>${esc(STAGE_LABELS[s.stage])}</td>
        <td>${s.status === 'done' ? '✓ 完成' : '… 进行中'}</td>
        <td>${s.estimatedMs ? (s.estimatedMs / 1000).toFixed(1) + ' s' : '—'}</td>
      </tr>`)
    .join('')

  const reasoningHtml = m.reasoning
    .map((r) => {
      const tag =
        r.kind === 'number' ? '<span class="tag num">数字</span>'
        : r.kind === 'conclusion' ? '<span class="tag concl">结论</span>'
        : ''
      return `<div class="rsn ${r.kind ?? 'thought'}">${tag}${esc(r.text)}</div>`
    })
    .join('')

  const chipsHtml = m.chips.map((c) => `<span class="chip">${esc(c.label)}</span>`).join('')
  const sourcesHtml = sources
    .map((s) => `
      <li>
        <b>${esc(s.title)}</b>
        <span class="muted"> · ${s.status === 'active' ? '已使用' : s.status === 'pending' ? '待采纳' : '已排除'}${s.relevance != null ? ' · 相关度 ' + Math.round(s.relevance * 100) + '%' : ''}</span>
        ${s.summary ? `<div class="muted small">${esc(s.summary)}</div>` : ''}
      </li>`)
    .join('')

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>思考过程回放 · ${esc(task.title)}</title>
<style>
  :root { --ink:#1a2233; --muted:#5b6678; --line:#e3e8f0; --accent:#0a9396; --accent2:#5b3df5; --good:#2f9e44; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f3f5fa; color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif; line-height:1.7; }
  .page { max-width:760px; margin:32px auto; background:#fff; border:1px solid var(--line); border-radius:16px; padding:34px 38px; box-shadow:0 12px 40px rgba(15,23,42,.08); }
  h1 { font-size:21px; margin:0 0 6px; }
  .meta { color:var(--muted); font-size:13px; margin-bottom:22px; }
  h2 { font-size:15px; margin:26px 0 10px; padding-left:10px; border-left:3px solid var(--accent); }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; background:#f8fafc; }
  .rsn { font-size:13.5px; padding:7px 11px; margin:7px 0; border-left:3px solid #dfe5ee; background:#f8fafc; border-radius:0 8px 8px 0; }
  .rsn.number { border-left-color:var(--accent2); }
  .rsn.conclusion { border-left-color:var(--good); font-weight:600; }
  .tag { display:inline-block; font-size:11px; padding:1px 7px; border-radius:6px; margin-right:7px; background:#ede9fe; color:#6d28d9; }
  .tag.concl { background:#dcfce7; color:#166534; }
  .chip { display:inline-block; font-size:12px; padding:3px 11px; border-radius:999px; background:#ccfbf1; color:#115e59; margin:0 7px 7px 0; }
  ul { margin:6px 0; padding-left:20px; font-size:13.5px; } li { margin:5px 0; }
  .muted { color:var(--muted); } .small { font-size:12px; }
  .partial { border:1px solid #bbf7d0; background:#f0fdf4; border-radius:12px; padding:12px 15px; font-size:13.5px; }
  .foot { margin-top:30px; padding-top:14px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
</style></head>
<body><div class="page">
  <h1>思考过程回放 · ${esc(task.title)}</h1>
  <div class="meta">导出时间 ${fmtTime(Date.now())} · 模式 ${esc(task.mode)} · 思考深度 ${esc(task.depth)} · 当前阶段：${stageLine}</div>

  <h2>阶段与步骤</h2>
  <table><thead><tr><th>#</th><th>步骤</th><th>阶段</th><th>状态</th><th>耗时</th></tr></thead>
  <tbody>${stepsHtml || '<tr><td colspan="5" class="muted">无结构化步骤（降级模式）</td></tr>'}</tbody></table>

  ${chipsHtml ? `<h2>上下文微信息</h2><div>${chipsHtml}</div>` : ''}

  <h2>实时推理流</h2>
  ${reasoningHtml || '<div class="muted">（无推理片段）</div>'}

  ${m.partial ? `<h2>阶段性结论</h2><div class="partial">${esc(m.partial.content)}</div>` : ''}

  <h2>使用的知识源（${sources.length}）</h2>
  <ul>${sourcesHtml}</ul>

  <div class="foot">由 Synthesis 思考态自动生成 · 事件驱动、无伪造步骤 · 本文件为自包含 HTML，可直接分享。</div>
</div></body></html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date()
  const name = `思考过程回放_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.html`
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function STAGE_ORDER_FN(cur?: string): string {
  if (!cur) return '—'
  return STAGE_LABELS[cur as keyof typeof STAGE_LABELS] ?? cur
}
