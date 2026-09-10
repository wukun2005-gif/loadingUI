import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThinkingTasks } from './sse/useThinkingTasks'
import { deriveModel } from './state/model'
import { exportThinkingReport } from './state/exportReport'
import type { SourcesApi } from './state/useSources'
import type { SourceNode, ThinkingDepth } from './types/sse'
import { AmbientLayer } from './components/AmbientLayer'
import { TaskView } from './components/TaskView'
import { TaskPanel } from './components/TaskPanel'
import { EscapeHatch } from './components/EscapeHatch'
import { MetricsPanel } from './components/MetricsPanel'
import { DemoTour } from './components/DemoTour'
import { DemoCursor } from './components/DemoCursor'
import { FakeFileDialog } from './components/FakeFileDialog'
import { ReplayModal } from './components/ReplayModal'
import { DEMO_ANCHORS, DEMO_SCRIPT, DEMO_SPEED, type DemoCtx } from './demo/demoScript'
import { track, getVariant } from './analytics/metrics'
import { useFeedback } from './feedback/useFeedback'

// 构建时间戳（vite.config define 注入），用于区分「是否看到最新版」
declare const __BUILD_STAMP__: string

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('synthesis_theme') as 'dark' | 'light') || 'dark' } catch { return 'dark' }
  })
  const [metricsOpen, setMetricsOpen] = useState(false)

  // F14 多任务并行流
  const [demoPaused, setDemoPaused] = useState(false)
  const tasksApi = useThinkingTasks(demoPaused)
  const { tasks, activeId, setActiveId, active, addTask, removeTask, restart, updateParams, resetAll } = tasksApi

  // F16 声音 / 触觉
  const { soundOn, toggleSound, setSound, notifyStage, notifyComplete } = useFeedback()

  // 各任务的知识源 API / 来源快照（由 TaskView 注册上来）
  const sourcesApiMap = useRef(new Map<string, SourcesApi>())
  const [sourcesSnapshot, setSourcesSnapshot] = useState<Record<string, SourceNode[]>>({})
  const registerSources = useCallback((id: string, api: SourcesApi | null) => {
    if (api) sourcesApiMap.current.set(id, api)
  }, [])
  const reportSources = useCallback((id: string, srcs: SourceNode[]) => {
    setSourcesSnapshot((prev) => (prev[id] === srcs ? prev : { ...prev, [id]: srcs }))
  }, [])

  // 受控态（供一键演示驱动）
  const [hatchOpen, setHatchOpen] = useState(false)
  const [collapseReasoning, setCollapseReasoning] = useState(false)
  const [collapseTree, setCollapseTree] = useState(false)
  const [participationCount, setParticipationCount] = useState(0)
  const [participationToast, setParticipationToast] = useState<string | null>(null)
  // 一键演示状态
  const [demoStep, setDemoStep] = useState(-1)
  const [introOpen, setIntroOpen] = useState(false)
  const [demoOpenId, setDemoOpenId] = useState<string | null>(null)
  const [fakePhase, setFakePhase] = useState<null | 'pick' | 'reading'>(null)
  // F15 回放任务 id
  const [replayId, setReplayId] = useState<string | null>(null)

  const variant = useMemo(() => getVariant(), [])
  const activeModel = useMemo(() => deriveModel(active?.events ?? []), [active?.events])

  const participationTimer = useRef<number>(0)
  const ranStep = useRef<number>(-1)
  const apiRef = useRef<DemoCtx>(null as unknown as DemoCtx)
  const [cursorTarget, setCursorTarget] = useState<string | null>(null)
  const [cursorClicking, setCursorClicking] = useState(false)
  const clickTimer = useRef<number>(0)
  const lastAddedId = useRef<string | null>(null)
  const lastNewTaskId = useRef<string | null>(null)

  // F11 明暗主题
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('synthesis_theme', theme) } catch { /* 忽略 */ }
  }, [theme])

  // F16：活动任务阶段切换 → 音效 + （移动端）触觉；完成提示音
  const lastStage = useRef<string | undefined>(undefined)
  const completedNotified = useRef<Set<string>>(new Set())
  useEffect(() => { lastStage.current = undefined }, [activeId])
  useEffect(() => {
    if (activeModel.currentStage && activeModel.currentStage !== lastStage.current) {
      lastStage.current = activeModel.currentStage
      notifyStage(activeModel.currentStage)
      track('stage_reached', { stage: activeModel.currentStage })
    }
  }, [activeModel.currentStage])
  useEffect(() => {
    if (active?.done && active.id && !completedNotified.current.has(active.id)) {
      completedNotified.current.add(active.id)
      notifyComplete()
      track('complete')
    }
  }, [active?.done, active?.id, notifyComplete])
  useEffect(() => { if (activeModel.partial) track('partial_view') }, [activeModel.partial])

  const notifyParticipation = (op: string) => {
    track('source_operation', { op })
    setParticipationCount((c) => c + 1)
    setParticipationToast('已通知 AI · 将于下一轮生成采纳')
    window.clearTimeout(participationTimer.current)
    participationTimer.current = window.setTimeout(() => setParticipationToast(null), 2400)
  }

  const onMode = (m: string) => {
    if (!active) return
    track('mode_switch', { mode: m })
    updateParams(active.id, { mode: m as TaskViewMode })
  }
  const onDepth = (d: ThinkingDepth) => {
    if (!active) return
    track('depth_switch', { depth: d })
    updateParams(active.id, { depth: d })
  }

  const onAddTask = () => {
    const id = addTask({})
    track('task_add')
    setActiveId(id)
  }
  const onSelectTask = (id: string) => { if (id !== activeId) { setActiveId(id); track('task_switch') } }
  const onReplay = (id: string) => { setReplayId(id); track('replay_open') }
  const onExport = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    exportThinkingReport(t, sourcesSnapshot[id] ?? [])
    track('report_export')
  }

  // 演示上下文（始终指向最新 handler）
  apiRef.current = {
    setMode: (m) => { if (active) updateParams(active.id, { mode: m as TaskViewMode }) },
    setSpeed: (s) => { if (active) updateParams(active.id, { speed: s }) },
    setDepth: (d) => { if (active) updateParams(active.id, { depth: d }) },
    openHatch: (v) => setHatchOpen(v),
    setCollapseReasoning,
    setCollapseTree,
    setSound: (on) => setSound(on),
    notifyParticipation,
    addSource: (title, type) => {
      const api = activeId ? sourcesApiMap.current.get(activeId) : undefined
      if (!api) return
      api.add(title, type, 'root')
      notifyParticipation('add')
    },
    openSource: (id) => setDemoOpenId(id),
    closeReader: () => setDemoOpenId(null),
    uploadFile: () => {
      const api = sourcesApiMap.current.get(activeId)
      if (!api) return
      const name = '2025 内部增长复盘.pdf'
      const content =
        '# 2025 内部增长复盘\n\n' +
        '本文件由用户在思考过程中实时上传，前端读取内容后即时入树。\n\n' +
        '## 增长概览\n' +
        '· 全年营收 ¥12.4 亿，同比 +11.7%。\n' +
        '· 新签客户 1,860 家，续约率 87%。\n\n' +
        '## 渠道拆解\n' +
        '· 直销贡献 58%，渠道贡献 42%。\n' +
        '· 海外增速 +23%，明显高于国内 +8%。\n\n' +
        '## 结论与动作\n' +
        '建议把海外渠道作为下一年主攻方向，同时控制折扣深度以稳住客单价。'
      const node = api.add(name, 'doc', 'root', { content })
      lastAddedId.current = node.id
      notifyParticipation('add')
    },
    openLastAdded: () => { if (lastAddedId.current) setDemoOpenId(lastAddedId.current) },
    openFakePicker: () => setFakePhase('pick'),
    closeFakePicker: () => setFakePhase(null),
    addDemoTask: () => {
      // 演示专用：快速档，速度略快于主流（约 4.3s 跑完），保证 f14 切回前完成、f15 回放节奏从容
      const id = addTask({ depth: 'fast', speed: DEMO_SPEED * 0.9 })
      lastNewTaskId.current = id
      track('task_add')
      return id
    },
    selectTask: (id) => setActiveId(id),
    selectLastTask: () => { if (lastNewTaskId.current) setActiveId(lastNewTaskId.current) },
    selectMain: () => setActiveId('main'),
    openLastTaskReplay: () => { if (lastNewTaskId.current) setReplayId(lastNewTaskId.current) },
    closeReplay: () => setReplayId(null),
    setCursor: setCursorTarget,
    setClicking: setCursorClicking,
  }

  const startDemo = () => {
    setIntroOpen(false)
    setDemoPaused(false)
    ranStep.current = -1
    setDemoOpenId(null)
    setCursorTarget(null)
    setFakePhase(null)
    setReplayId(null)
    lastAddedId.current = null
    lastNewTaskId.current = null
    setSound(false)
    // 每次演示从单个主任务、标准知识源树开始
    for (const t of tasks) if (t.id !== 'main') removeTask(t.id)
    sourcesApiMap.current.get('main')?.reset()
    setParticipationCount(0)
    resetAll({ mode: 'full', depth: 'standard', speed: DEMO_SPEED })
    setHatchOpen(false)
    setCollapseReasoning(false)
    setCollapseTree(false)
    setParticipationToast(null)
    setDemoStep(0)
  }
  const finishDemo = () => {
    setDemoStep(-1)
    setDemoPaused(false)
    setDemoOpenId(null)
    setCursorTarget(null)
    setFakePhase(null)
    setReplayId(null)
    window.clearTimeout(clickTimer.current)
    for (const t of tasks) if (t.id !== 'main') removeTask(t.id)
    updateParams('main', { mode: 'full', depth: 'standard', speed: 1 })
    setActiveId('main')
    setSound(false)
    setHatchOpen(false)
    setCollapseReasoning(false)
    setCollapseTree(false)
  }

  // 引导式演示 runner
  useEffect(() => {
    if (demoStep < 0) return
    if (demoStep >= DEMO_SCRIPT.length) { finishDemo(); return }
    const step = DEMO_SCRIPT[demoStep]
    if (ranStep.current !== demoStep) {
      ranStep.current = demoStep
      window.clearTimeout(clickTimer.current)
      step.enter?.(apiRef.current)

      const pointer = step.pointer
      if (pointer) {
        const sel =
          pointer.selector === '@last-added'
            ? lastAddedId.current
              ? `[data-source-id="${lastAddedId.current}"]`
              : null
            : pointer.selector
        setCursorTarget(sel)
        setCursorClicking(false)
        clickTimer.current = window.setTimeout(() => {
          setCursorClicking(true)
          if (pointer.click && sel) {
            document.querySelector(sel)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          }
          step.run?.(apiRef.current)
          window.setTimeout(() => setCursorClicking(false), 600)
        }, pointer.delay ?? 900)
      } else {
        setCursorTarget(null)
        step.run?.(apiRef.current)
      }
    }
    if (demoPaused) return
    const id = window.setTimeout(() => setDemoStep((s) => s + 1), step.duration)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoStep, demoPaused])

  // 把当前步骤高亮目标滚动到视口中央
  useEffect(() => {
    if (demoStep < 0) return
    const key = DEMO_SCRIPT[demoStep]?.highlight
    if (!key) return
    const sel = DEMO_ANCHORS[key]
    if (!sel) return
    const timer = window.setTimeout(() => {
      const el = document.querySelector(sel)
      if (!el) return
      const r = el.getBoundingClientRect()
      const top = window.scrollY + r.top - Math.max(16, (window.innerHeight - r.height) / 2)
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [demoStep])

  const curStep = demoStep >= 0 && demoStep < DEMO_SCRIPT.length ? DEMO_SCRIPT[demoStep] : null
  const hl = curStep?.highlight
  const replayTask = replayId ? tasks.find((t) => t.id === replayId) : null

  return (
    <div className="app">
      <AmbientLayer stage={activeModel.currentStage} reduced={false} />
      <header className="topbar">
        <div className="brand">Synthesis · 思考态</div>
        <div className="mode-switch">
          <button
            className={demoStep >= 0 ? 'seg demo-cta active' : 'seg demo-cta'}
            onClick={() => (demoStep >= 0 ? finishDemo() : setIntroOpen(true))}
          >
            {demoStep >= 0 ? '⏹ 结束演示' : '🎬 一键演示'}
          </button>
          {(['full', 'fallback2', 'fallback3'] as const).map((m) => (
            <button key={m} className={m === (active?.mode ?? 'full') ? 'seg active' : 'seg'} onClick={() => onMode(m)}>
              {m === 'full' ? '完整(F1-F7)' : m === 'fallback2' ? '降级2(无步骤)' : '降级3(仅进度)'}
            </button>
          ))}
          <button className="seg" onClick={() => active && restart(active.id)}>↻ 重跑</button>
          <button
            className="seg"
            data-sound-toggle
            onClick={() => { toggleSound(); track('sound_toggle', { on: !soundOn }) }}
            title="F16 阶段切换音效（触觉仅触屏设备生效）"
          >
            {soundOn ? '🔊 音效开' : '🔇 音效关'}
          </button>
          <button className="seg" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀ 浅色' : '🌙 深色'}
          </button>
          <button className="seg" onClick={() => setMetricsOpen((o) => !o)}>📊 度量</button>
        </div>
      </header>

      <div className="tasks-shell">
        {demoPaused && curStep && (
          <div className="paused-banner">⏸ 演示已暂停 · 时间线 / 推理流 / 进度 / 氛围层均已冻结（点右侧「▶ 继续演示」恢复）</div>
        )}
        <TaskPanel
          tasks={tasks}
          activeId={activeId}
          onSelect={onSelectTask}
          onAdd={onAddTask}
          onRemove={removeTask}
          onReplay={onReplay}
          highlight={demoStep >= 0 && hl === 'tasks'}
          highlightAdd={demoStep >= 0 && hl === 'taskadd'}
        />
        {tasks.map((t) => (
          <div key={t.id} className="taskview-slot" style={{ display: t.id === activeId ? 'block' : 'none' }}>
            <TaskView
              task={t}
              active={t.id === activeId}
              hl={hl}
              demoOpenId={demoOpenId}
              demoFakePicker={demoStep >= 0}
              collapseReasoning={collapseReasoning}
              collapseTree={collapseTree}
              onCollapseReasoning={setCollapseReasoning}
              onCollapseTree={setCollapseTree}
              onFakeOpen={() => setFakePhase('pick')}
              onDepthChange={onDepth}
              onParticipate={notifyParticipation}
              onReplay={onReplay}
              onExport={onExport}
              registerSources={registerSources}
              reportSources={reportSources}
            />
          </div>
        ))}
      </div>

      <EscapeHatch
        done={!!active?.done}
        runId={active?.startedAt}
        onCancel={() => active && restart(active.id)}
        open={hatchOpen}
        onOpenChange={setHatchOpen}
        highlight={hl === 'hatch'}
        forceVisible={hl === 'hatch' || hatchOpen}
      />

      {participationToast && <div className="participation-toast">{participationToast}（本次会话已参与 {participationCount} 次）</div>}

      {fakePhase && (
        <FakeFileDialog
          phase={fakePhase}
          onPick={() => setFakePhase('reading')}
          onDone={() => { setFakePhase(null); apiRef.current.uploadFile() }}
          onCancel={() => setFakePhase(null)}
        />
      )}

      {curStep && (
        <DemoTour
          step={curStep}
          index={demoStep}
          total={DEMO_SCRIPT.length}
          paused={demoPaused}
          onTogglePause={() => setDemoPaused((p) => !p)}
          onSkip={finishDemo}
        />
      )}

      {introOpen && (
        <div className="demo-modal" role="dialog" aria-modal="true">
          <div className="demo-modal-box">
            <div className="demo-modal-title">🎬 一键演示</div>
            <p className="demo-modal-text">
              自动播放一段引导式巡演，逐项演示全部能力：四阶段时间线、实时推理流、
              知识源树（查看 → 点开读全文 → 上传文件补充来源）、上下文 chips、四级逃生舱、
              三档兜底降级、思考深度调节、推理画布、多任务并行、过程回放与声音反馈。
              演示中会有一个模拟鼠标替你点击，每一步也会自动把目标滚动到屏幕中央。
            </p>
            <p className="demo-modal-text demo-modal-sub">演示中可随时 暂停 / 跳过；也可在任意步骤点击顶栏按钮自由探索。</p>
            <div className="demo-modal-actions">
              <button className="mini" onClick={() => setIntroOpen(false)}>取消</button>
              <button className="mini primary" onClick={startDemo}>开始演示</button>
            </div>
          </div>
        </div>
      )}

      {metricsOpen && <MetricsPanel variant={variant} onClose={() => setMetricsOpen(false)} />}

      {replayTask && (
        <ReplayModal task={replayTask} sources={sourcesSnapshot[replayTask.id] ?? []} onClose={() => setReplayId(null)} />
      )}

      {demoStep >= 0 && <DemoCursor target={cursorTarget} clicking={cursorClicking} />}

      <div className="build-stamp">构建于 {new Date(__BUILD_STAMP__).toLocaleString()}</div>
    </div>
  )
}

type TaskViewMode = 'full' | 'fallback2' | 'fallback3'
