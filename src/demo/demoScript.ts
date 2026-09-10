// 一键演示脚本：覆盖 F1–F16 的方方面面，带自动操作（添加知识源 / 切降级 / 深度档 /
// 多任务 / 回放 / 音效开关）。参考 agentEvalPlatform 的「一键演示」范式。

import type { SourceType } from '../types/sse'
import type { ThinkingDepth } from '../types/sse'

export interface DemoCtx {
  setMode: (m: string) => void
  setSpeed: (s: number) => void
  /** F12 切换思考深度（快速 / 标准 / 深度） */
  setDepth: (d: ThinkingDepth) => void
  openHatch: (v: boolean) => void
  setCollapseReasoning: (v: boolean) => void
  setCollapseTree: (v: boolean) => void
  /** F16 受控开关音效（保证演示状态确定） */
  setSound: (on: boolean) => void
  notifyParticipation: (op: string) => void
  addSource: (title: string, type: SourceType) => void
  /** 打开某个来源的阅读器（演示「打开即读全文」） */
  openSource: (id: string) => void
  /** 关闭阅读器 */
  closeReader: () => void
  /** 模拟「上传文件」：读取内容 → 入树（不自动打开阅读器，保证添加区可见） */
  uploadFile: () => void
  /** 打开刚上传的那个来源（演示上传内容确实被读取） */
  openLastAdded: () => void
  /** 打开 / 关闭「模拟系统文件选择器」（演示点击上传 → 选文件的全过程） */
  openFakePicker: () => void
  closeFakePicker: () => void
  /** F14 新增一个并行任务（快速档 + 加速，便于演示中跑完），返回任务 id */
  addDemoTask: () => string
  /** F14 切换查看指定任务 */
  selectTask: (id: string) => void
  selectLastTask: () => void
  selectMain: () => void
  /** F15 打开刚新增任务的回放 / 关闭回放 */
  openLastTaskReplay: () => void
  closeReplay: () => void
  /** 演示光标：移动到指定选择器 / 显示点击涟漪 */
  setCursor: (sel: string | null) => void
  setClicking: (v: boolean) => void
}

/**
 * 演示高亮目标 → DOM 选择器。
 * 每步切换时会把对应元素滚动到视口中央，避免目标在屏幕外导致「演示了但用户看不见」。
 */
export const DEMO_ANCHORS: Record<string, string> = {
  timeline: '.timeline',
  reasoning: '.reasoning',
  progress: '.progress',
  chips: '.chips',
  tree: '.tree',
  add: '.tree-add',
  hatch: '.hatch',
  depth: '.depth',
  canvas: '.canvas-panel',
  tasks: '.taskpanel',
  taskadd: '[data-task-add]',
  replay: '.replay-overlay',
  sound: '[data-sound-toggle]',
}

export interface DemoStep {
  id: string
  /** 高亮目标组件（与 DEMO_ANCHORS 对应） */
  highlight?: string
  /**
   * 模拟鼠标：把光标移到该选择器指向的元素并点击。
   * click=true 时会派发真实 DOM click（触发组件自身的 onClick）；
   * click=false 则只做「指到那里 + 点击涟漪」，实际动作交给 run()。
   * 特殊值 '@last-added' 表示「刚上传的那个知识源节点」。
   * delay：光标移到目标后停留多少毫秒再点击（默认 900）。
   */
  pointer?: { selector: string; click?: boolean; delay?: number }
  title: string
  text: string
  duration: number
  /** 进入步骤的瞬间立即执行（早于 pointer 的延迟点击），用于清理上一步遗留界面 */
  enter?: (ctx: DemoCtx) => void
  run?: (ctx: DemoCtx) => void
}

export const DEMO_SPEED = 0.35

export const DEMO_SCRIPT: DemoStep[] = [
  {
    id: 'overview',
    title: '总览 · 思考态 UX',
    text: '传统 AI 的“等待”= 一个转圈。本 Demo 把等待重构成一段有结构、可参与、可控制的体验。下面逐项展示每个能力（F1–F16）。',
    duration: 4600,
  },
  {
    id: 'f1',
    highlight: 'timeline',
    title: 'F1 · 四阶段时间线',
    text: 'AI 的思考被拆成「检索→分析→综合→收尾」四个显式阶段。你能看到现在在第几阶段、还差多少，而不是一条看不懂的进度条。',
    duration: 3600,
  },
  {
    id: 'f2',
    highlight: 'reasoning',
    title: 'F2 · 实时推理流',
    text: '推理过程随 SSE 实时流式展开，关键数字与结论用不同样式区分。可用右上「⏸ 滚屏」暂停自动滚动、回看前面的片段（注意：它暂停的是滚动，不会倒流重播推理——我们不回放假内容）。',
    duration: 4200,
  },
  {
    id: 'f7a',
    highlight: 'tree',
    title: 'F7 · 知识源树（思考中可见）',
    text: 'AI 此刻正在用哪些材料，以思维导图实时呈现：节点显示类型与相关度，已排除的会变灰。下面把它滚动到视野中央，然后打开其中一份给你看。',
    duration: 4400,
  },
  {
    id: 'f7b',
    highlight: 'tree',
    title: 'F7 · 点击节点即读全文',
    text: '把鼠标移到任意节点点一下——会打开一页居中的「文档阅读器」：带目录导航、章节排版与阅读进度条；底部可排除 / 启用 / 删除（不含编辑，守住源可信）。现在点开《2024 行业白皮书》。',
    duration: 6200,
    pointer: { selector: '[data-source-id="s1"]', click: true },
    run: (ctx) => ctx.openSource('s1'),
  },
  {
    id: 'f7c',
    highlight: 'add',
    title: 'F7 · 实时上传文件补充知识源',
    text: '发现 AI 漏了材料？点高亮处的「上传文件」，从本地选 PDF / 文档 / 图片，前端读取内容后即时入树——留意知识源树会立刻多出一个新节点。下面演示上传《2025 内部增长复盘.pdf》；注意它标为「待采纳」而不是假装本轮已生效，这是忠实性底线。',
    duration: 12800,
    pointer: { selector: '.file-picker', click: true, delay: 1700 },
    enter: (ctx) => ctx.closeReader(),
    run: (ctx) => {
      ctx.openFakePicker()
      window.setTimeout(() => {
        ctx.setCursor('[data-fake-file="2025 内部增长复盘.pdf"]')
      }, 2000)
      window.setTimeout(() => {
        ctx.setClicking(true)
        document.querySelector('[data-fake-file="2025 内部增长复盘.pdf"]')?.dispatchEvent(
          new MouseEvent('click', { bubbles: true })
        )
        window.setTimeout(() => ctx.setClicking(false), 700)
      }, 3300)
      window.setTimeout(() => ctx.setCursor(null), 4100)
    },
  },
  {
    id: 'f7d',
    highlight: 'tree',
    title: 'F7 · 上传内容已被读取',
    text: '新节点已在树上。再点它一下，可以看到上传的文档内容确实被完整读取、渲染成带目录的文档页——这就是「参与式等待」：你补充的材料，下一轮生成就会采纳。',
    duration: 5400,
    pointer: { selector: '@last-added', click: true },
    run: (ctx) => ctx.openLastAdded(),
  },
  {
    id: 'f5',
    highlight: 'chips',
    title: 'F5 · 上下文微信息（chips）',
    text: 'chips 就是这排小标签：AI 此刻在关注什么（比如「对比维度：营收 / 增速 / 毛利」），由 SSE 的 context_chip 事件实时推送，让“黑盒”多透一点光。它只在有内容时出现。',
    duration: 4200,
    pointer: { selector: '.chips' },
    enter: (ctx) => ctx.closeReader(),
  },
  {
    id: 'f6',
    highlight: 'hatch',
    title: 'F6 · 四级逃生舱',
    text: '等待不是只能“等”或“取消”。点一下右下角「⌘ 逃生舱」，展开四档控制：① 静音/收起 ② 后台运行（完成通知）③ 取消（二次确认）④ 紧急停止。',
    duration: 5200,
    pointer: { selector: '.hatch-btn', click: true },
    enter: (ctx) => ctx.closeReader(),
  },
  {
    id: 'f8a',
    highlight: 'progress',
    title: 'F8 · 兜底降级（无步骤）',
    text: '当无法获取结构化步骤时，自动降级为“推理流 + 进度”（第 2 档），而非空白或假进度。',
    duration: 5400,
    enter: (ctx) => {
      ctx.closeReader()
      ctx.openHatch(false) // 收起 f6 展开的逃生舱面板，避免遮挡换挡界面
      ctx.setMode('fallback2')
    },
  },
  {
    id: 'f8b',
    highlight: 'progress',
    title: 'F8 · 兜底降级（第 3 档）',
    text: '极端情况（无步骤无推理）只给缓动进度 + 呼吸，绝不展示假步骤——守住忠实性底线。',
    duration: 5400,
    enter: (ctx) => {
      ctx.closeReader()
      ctx.setMode('fallback3')
    },
  },
  {
    id: 'f12',
    highlight: 'depth',
    title: 'F12 · 可调节思考深度',
    text: '回到完整流。思考深度可在「快速回答 / 标准 / 深度分析」之间切换：深度档会多做敏感性分析与风险权衡，步骤更多、预估时间也更长——时长差异由后端按 depth 编排，不是前端写死。下面切到「深度分析」，注意步骤变成 8 个。',
    duration: 6800,
    enter: (ctx) => {
      ctx.openHatch(false)
      ctx.setMode('full')
    },
    // 只指过去 + 涟漪，实际切换由 run 完成（避免真实点击与兜底各重连一次）
    pointer: { selector: '[data-depth="deep"]', click: false, delay: 1300 },
    run: (ctx) => ctx.setDepth('deep'),
  },
  {
    id: 'f13',
    highlight: 'canvas',
    title: 'F13 · 可视化推理画布',
    text: '推理过程被映射成一张网络拓扑：问题 → 四阶段 → 步骤与知识源 → 结论，节点随事件实时“生长”，进行中的连线带流动动画。点任意节点可查看详情——现在点开「提取关键指标」节点，右侧/下方会列出它的推理片段。',
    duration: 7600,
    pointer: { selector: '[data-canvas-node="step-st3"]', click: true, delay: 1500 },
  },
  {
    id: 'f14',
    highlight: 'tasks',
    title: 'F14 · 多任务并行进度面板',
    text: '可以同时跑多个 AI 任务：点「＋ 新任务」会开出一条独立 SSE 流，每个任务有自己的阶段、进度与知识源，互不影响。下面新增一个「快速档」任务并加速跑完；随后切到它、再切回主任务——注意主任务的思考过程一直保留着。',
    duration: 9000,
    pointer: { selector: '[data-task-add]', click: false, delay: 1000 },
    run: (ctx) => {
      const id = ctx.addDemoTask()
      // 任务卡出现后，光标移到新任务上点选切换
      window.setTimeout(() => ctx.setCursor(`[data-task-id="${id}"]`), 2600)
      window.setTimeout(() => {
        ctx.setClicking(true)
        document.querySelector(`[data-task-id="${id}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        ctx.selectTask(id)
        window.setTimeout(() => ctx.setClicking(false), 600)
      }, 3500)
      // 再切回主任务
      window.setTimeout(() => ctx.setCursor('[data-task-id="main"]'), 5600)
      window.setTimeout(() => {
        ctx.setClicking(true)
        document.querySelector('[data-task-id="main"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        ctx.selectMain()
        window.setTimeout(() => ctx.setClicking(false), 600)
      }, 6500)
      window.setTimeout(() => ctx.setCursor(null), 7600)
    },
  },
  {
    id: 'f15',
    highlight: 'replay',
    title: 'F15 · 思考过程回放',
    text: '刚才的快速任务已经跑完。切到它并打开「回放」：按原始事件间隔重放完整思考过程，可暂停、可 1×/2×/4× 快进、可拖动进度条；还能「导出可分享图文」——生成一份自包含 HTML，直接发给他人查看。',
    duration: 9000,
    enter: (ctx) => ctx.selectLastTask(),
    run: (ctx) => ctx.openLastTaskReplay(),
  },
  {
    id: 'f16',
    highlight: 'sound',
    title: 'F16 · 声音 / 触觉反馈',
    text: '阶段切换时会有一声极弱的提示音（WebAudio 合成，无音频资源），默认关闭、顶栏可随时开关；触屏设备上还会伴随一次轻微振动，桌面端不会振动。下面打开音效，留意接下来阶段切换的细微声音。',
    duration: 4600,
    enter: (ctx) => {
      ctx.closeReplay()
      ctx.selectMain()
    },
    pointer: { selector: '[data-sound-toggle]', click: false, delay: 1200 },
    run: (ctx) => ctx.setSound(true),
  },
  {
    id: 'outro',
    title: '全貌 · 对比传统等待',
    text: '从被动围观 → 结构化白盒 + 可参与 + 可控 + 可回放。F1–F16 构成完整的「思考态」。点击顶栏按钮可自由探索。',
    duration: 5600,
    run: (ctx) => {
      ctx.setMode('full')
      ctx.setDepth('standard')
      ctx.setSpeed(1)
      ctx.setSound(false)
      ctx.closeReplay()
      ctx.selectMain()
      ctx.openHatch(false)
      ctx.setCollapseReasoning(false)
      ctx.setCollapseTree(false)
    },
  },
]
