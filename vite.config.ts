import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_SOURCES } from './src/mock/defaultSources'

/**
 * M0 出口标准：SSE 事件契约由「真实后端」驱动（本 Demo 用 mock 流替代真实
 * FastAPI+LangGraph 后端，但推送的是与 PRD §技术方案(SSE) 完全一致的事件流，
 * 前端用原生 EventSource 消费，不依赖 setTimeout 假数据）。
 *
 * 端点：
 *   GET  /api/thinking-stream?mode=full|fallback2|fallback3&depth=fast|standard|deep&speed=&q=
 *        -> text/event-stream（q 为问题预设序号，F14 多任务并行时区分任务）
 *   POST /api/sources                                         -> CRUD 确认（下一轮生效）
 */

type Stage = 'retrieving' | 'analyzing' | 'synthesizing' | 'finalizing'
type Mode = 'full' | 'fallback2' | 'fallback3'

interface Ev {
  type: string
  [k: string]: unknown
}

function sseMockPlugin() {
  return {
    name: 'synthesis-sse-mock',
    configureServer(server: any) {
      server.middlewares.use('/api/thinking-stream', (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', 'http://localhost')
        let mode = (url.searchParams.get('mode') || 'full') as Mode
        if (!['full', 'fallback2', 'fallback3'].includes(mode)) mode = 'full'
        // F12 思考深度：fast 步骤更短、deep 增加额外步骤且单步更长（对应更长预估时间）
        const depth = (url.searchParams.get('depth') || 'standard') as 'fast' | 'standard' | 'deep'
        // F14 多任务：不同任务用不同问题标题，区分并行的思考态
        const qIdx = Number(url.searchParams.get('q') || '0') || 0
        // speed: 一键演示用 0.35 加速；默认 1
        const speed = Number(url.searchParams.get('speed')) || 1
        const D = (ms: number) => Math.round(ms * speed)

        // 深度档时长系数：快速回答整体更快，深度分析更慢、更细
        const depthFactor = depth === 'fast' ? 0.55 : depth === 'deep' ? 1.45 : 1

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })

        let seq = 0
        const send = (e: Ev) => {
          const payload = JSON.stringify({ ...e, ts: Date.now(), seq: seq++ })
          res.write(`data: ${payload}\n\n`)
        }

        const stages: Stage[] = ['retrieving', 'analyzing', 'synthesizing', 'finalizing']
        const QUESTION_TITLES = [
          '对比三家竞品的季度营收与增长策略',
          '评估海外市场进入策略（欧盟 / 东南亚）',
          '复盘上季度投放 ROI 并给出下季度预算建议',
          '对比三种云方案的三年总体拥有成本（TCO）',
        ]
        send({ type: 'meta', stages, scenario: mode, title: QUESTION_TITLES[qIdx % QUESTION_TITLES.length] })

        // 初始知识源树（F7）：与前端兜底同源，避免数据分叉
        const sources = DEFAULT_SOURCES
        if (mode !== 'fallback3') {
          for (const s of sources) send({ type: 'source', op: 'upsert', source: s })
        }

        // 时间线（F1）仅在 full 模式展示阶段细节
        if (mode === 'full') {
          send({ type: 'stage', stage: 'retrieving', label: '检索知识源' })
        }

        // 编排调度表：{ delay(ms 起算), factory }
        const sched: Array<{ delay: number; e: Ev }> = []
        let t = 600

        // 基础步骤（标准档）；深度档在分析 / 综合阶段各插一个额外步骤，体现「想得更深」
        const baseSteps = [
          { id: 'st1', label: '检索竞品财报', stage: 'retrieving', ms: 3500, thought: '打开竞品 A 的投资者关系页面，定位最新季度财报。' },
          { id: 'st2', label: '解析需求文档', stage: 'retrieving', ms: 2800, thought: '从用户上传文档中提取对比维度：营收、增速、毛利率、区域结构。' },
          { id: 'st3', label: '提取关键指标', stage: 'analyzing', ms: 4200, thought: '竞品 A 营收 +15.3%，竞品 B +9.1%，我方 +11.7%。', num: '15.3% / 9.1% / 11.7%' },
        ]
        const deepExtraAnalyze = [
          { id: 'st3x', label: '敏感性与情景分析', stage: 'analyzing', ms: 3800, thought: '对汇率与折扣率做 ±5% 敏感性测试，观察结论稳健性。', num: '悲观/中性/乐观 三情景' },
        ]
        const midSteps = [
          { id: 'st4', label: '交叉验证数据来源', stage: 'analyzing', ms: 3600, thought: '白皮书口径与财报一致，区域结构以财报为准。' },
          { id: 'st5', label: '生成对比结论', stage: 'synthesizing', ms: 4600, thought: '竞品 A 增速领先但毛利承压；我方增速居中、结构更稳。', concl: '结论：增速梯队 A>B≈我方，但稳定性我方占优。' },
        ]
        const deepExtraSynth = [
          { id: 'st5x', label: '风险与机会权衡', stage: 'synthesizing', ms: 4200, thought: '机会在海外增量，风险在价格战拖累毛利，给出对冲建议。', concl: '补充：海外加码 + 折扣纪律，作为两条并行建议。' },
        ]
        const tailSteps = [
          { id: 'st6', label: '排版与摘要', stage: 'finalizing', ms: 2600, thought: '输出对比表与一句话摘要。' },
        ]
        const steps =
          mode === 'full'
            ? [
                ...baseSteps,
                ...(depth === 'deep' ? deepExtraAnalyze : []),
                ...midSteps,
                ...(depth === 'deep' ? deepExtraSynth : []),
                ...tailSteps,
              ].map((s) => ({ ...s, ms: Math.round(s.ms * depthFactor) }))
            : []

        if (mode === 'full') {
          let idx = 0
          // 预计算每步之后的剩余总时长，让 ETA 与深度档真实对应（深度档预估更久）
          const totalMs = steps.reduce((a, s) => a + s.ms + 600, 0)
          let elapsedMs = 0
          for (const st of steps) {
            const remainingAfter = totalMs - elapsedMs - st.ms - 600
            sched.push({ delay: t, e: { type: 'step_started', stepId: st.id, label: st.label, stage: st.stage, index: idx + 1, total: steps.length, estimatedMs: st.ms } })
            sched.push({ delay: t + Math.round(700 * depthFactor), e: { type: 'reasoning_snippet', stepId: st.id, text: st.thought, kind: 'thought' } })
            if (st.num) sched.push({ delay: t + Math.round(1500 * depthFactor), e: { type: 'reasoning_snippet', stepId: st.id, text: st.num, kind: 'number' } })
            if (st.concl) sched.push({ delay: t + st.ms - 900, e: { type: 'reasoning_snippet', stepId: st.id, text: st.concl, kind: 'conclusion' } })
            sched.push({ delay: t + st.ms, e: { type: 'step_completed', stepId: st.id, resultSummary: st.label + ' 完成', durationMs: st.ms } })
            const pct = Math.round(((idx + 1) / steps.length) * 100)
            sched.push({ delay: t + st.ms + 200, e: { type: 'progress_update', percent: pct, etaMs: Math.max(0, remainingAfter), basis: 'steps' } })
            if (idx === 1) sched.push({ delay: t + 1200, e: { type: 'context_chip', id: 'c1', label: depth === 'deep' ? '深度档: 含敏感性/风险权衡' : '对比维度: 营收/增速/毛利', tone: 'info' } })
            // 结论芯片：深度档额外给一条关键发现
            if (depth === 'deep' && st.id === 'st5x') sched.push({ delay: t + 1000, e: { type: 'context_chip', id: 'c2', label: '关键发现: 海外为主要增量', tone: 'warn' } })
            if (idx === 4 || (depth === 'deep' && st.id === 'st5x')) sched.push({ delay: t + 800, e: { type: 'partial_result', title: '阶段性结论', content: '竞品 A 增速领先但毛利承压；我方增速居中、结构更稳。' } })
            if (st.stage === 'analyzing' && (st.id === 'st3')) sched.push({ delay: t, e: { type: 'stage', stage: 'analyzing', label: '分析证据' } })
            if (st.stage === 'synthesizing' && st.id === 'st5') sched.push({ delay: t, e: { type: 'stage', stage: 'synthesizing', label: '综合结论' } })
            if (st.stage === 'finalizing') sched.push({ delay: t, e: { type: 'stage', stage: 'finalizing', label: '收尾排版' } })
            t += st.ms + 600
            elapsedMs += st.ms + 600
            idx++
          }
        } else if (mode === 'fallback2') {
          // 无步骤：仅推理流 + 进度（F8 第2档）
          const thoughts = [
            '正在阅读相关材料…',
            '提取关键数字：营收 +15.3% / +9.1% / +11.7%。',
            '交叉核对口径一致性…',
            '形成对比结论：增速 A 领先，我方结构更稳。',
          ]
          let i = 0
          for (const th of thoughts) {
            sched.push({ delay: t, e: { type: 'reasoning_snippet', text: th, kind: i === 1 ? 'number' : i === 3 ? 'conclusion' : 'thought' } })
            sched.push({ delay: t + 400, e: { type: 'progress_update', percent: Math.round(((i + 1) / thoughts.length) * 100), etaMs: Math.round((thoughts.length - i - 1) * 3000 * depthFactor), basis: 'heuristic' } })
            t += Math.round(3200 * depthFactor)
            i++
          }
        } else {
          // fallback3：无步骤无推理，仅缓动进度 + 呼吸（F8 第3档，不展示假步骤）
          for (let i = 1; i <= 5; i++) {
            sched.push({ delay: t, e: { type: 'progress_update', percent: i * 20, etaMs: Math.round((5 - i) * 2500 * depthFactor), basis: 'heuristic' } })
            t += Math.round(2500 * depthFactor)
          }
        }

        sched.push({ delay: t + 400, e: { type: 'done', answerId: 'ans_' + Date.now() } })

        const schedScaled = sched.map((s) => ({ delay: D(s.delay), e: s.e }))
        const timers: NodeJS.Timeout[] = []
        const startAt = Date.now()
        for (const item of schedScaled) {
          timers.push(setTimeout(() => send(item.e), item.delay))
        }
        // 心跳，避免代理断流
        const hb = setInterval(() => {
          if (res.writableEnded) return
          res.write(`: hb ${Date.now() - startAt}\n\n`)
        }, 8000)

        const cleanup = () => {
          timers.forEach(clearTimeout)
          clearInterval(hb)
          try { res.end() } catch {}
        }
        req.on('close', cleanup)
        req.on('error', cleanup)
      })

      // CRUD 确认端点（知识源实时操作走「下一轮生效」安全分支）
      server.middlewares.use('/api/sources', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.writeHead(405).end('Method Not Allowed')
          return
        }
        let body = ''
        req.on('data', (c: Buffer) => (body += c.toString()))
        req.on('end', () => {
          let parsed: any = {}
          try { parsed = JSON.parse(body || '{}') } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          // 真实后端此处应校验内容安全 + 防 SSRF；Demo 仅确认
          res.end(JSON.stringify({ ok: true, op: parsed.op, adopted: 'next-round', note: '将在下一轮生成中采纳' }))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), sseMockPlugin()],
  // 构建时间戳：注入到页面，用于区分「是否看到最新版」（终结预览缓存扯皮）
  define: { __BUILD_STAMP__: JSON.stringify(new Date().toISOString()) },
  server: { host: true, port: 5173 },
})
