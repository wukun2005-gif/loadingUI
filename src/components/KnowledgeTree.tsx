import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SourceNode, SourceType } from '../types/sse'
import type { SourcesApi } from '../state/useSources'

interface Props {
  sources: SourceNode[]
  touched: Set<string>
  api: SourcesApi
  highlight?: boolean
  /** 高亮「添加来源」区域（一键演示用） */
  highlightAdd?: boolean
  /** 受控打开某个来源的阅读器（一键演示用）；null = 关闭 */
  openId?: string | null
  /** 演示模式：拦截「上传文件」点击，改走模拟文件选择器（避免弹出系统对话框打断演示） */
  demoFakePicker?: boolean
  onFakeOpen?: () => void
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  onParticipate?: (op: string) => void
}

const COL_W = 240
const ROW_H = 70
const NODE_W = 206
const NODE_H = 40

const TYPE_LABEL: Record<SourceType, string> = {
  doc: '文档',
  url: '链接',
  user: '用户输入',
}

// 知识源树（F7）：点击节点「打开阅读」全文；支持排除/启用/删除（不含编辑，守住源可信）；
// 下方「添加来源」以文件选择器为主，链接 / 文本为次级选项。
export function KnowledgeTree({ sources, touched, api, highlight, highlightAdd, openId, demoFakePicker, onFakeOpen, collapsed: collapsedProp, onCollapsedChange, onParticipate }: Props) {
  const [readerId, setReaderId] = useState<string | null>(null)
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // 添加来源交互状态
  const [menuOpen, setMenuOpen] = useState(false)
  const [inlineMode, setInlineMode] = useState<'url' | 'text' | null>(null)
  const [urlVal, setUrlVal] = useState('')
  const [textVal, setTextVal] = useState('')
  const msgTimer = useRef<number>(0)

  const collapsed = collapsedProp ?? internalCollapsed
  const reader = readerId ? sources.find((s) => s.id === readerId) ?? null : null

  // 受控打开 / 关闭阅读器（一键演示驱动）
  useEffect(() => {
    setReaderId(openId ?? null)
  }, [openId])

  const layout = useMemo(() => {
    const byId = new Map(sources.map((s) => [s.id, s]))
    const childrenOf = (id: string) => sources.filter((s) => s.parentId === id)
    const depthOf = (s: SourceNode): number => {
      let d = 0
      let cur: SourceNode | undefined = s
      const seen = new Set<string>()
      while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
        seen.add(cur.id)
        cur = byId.get(cur.parentId)
        d++
      }
      return d
    }
    const pos = new Map<string, { x: number; y: number; depth: number }>()
    let leaf = 0
    const visit = (id: string): number => {
      const node = byId.get(id)!
      const d = depthOf(node)
      const kids = childrenOf(id)
      if (kids.length === 0) {
        const y = leaf * ROW_H + ROW_H
        leaf++
        pos.set(id, { x: d, y, depth: d })
        return y
      }
      const ys = kids.map((k) => visit(k.id))
      const y = (ys[0] + ys[ys.length - 1]) / 2
      pos.set(id, { x: d, y, depth: d })
      return y
    }
    const roots = sources.filter((s) => !s.parentId || !byId.has(s.parentId!))
    roots.forEach((r) => visit(r.id))
    const maxDepth = Math.max(0, ...[...pos.values()].map((p) => p.depth))
    const width = (maxDepth + 1) * COL_W + 30
    const height = Math.max(leaf, 1) * ROW_H + ROW_H
    return { pos, width, height }
  }, [sources])

  const flash = (text: string) => {
    setMsg(text)
    window.clearTimeout(msgTimer.current)
    msgTimer.current = window.setTimeout(() => setMsg(null), 2400)
  }

  const toggleCollapse = () => {
    const next = !collapsed
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  // —— 添加来源：原生文件输入框（样式化为按钮，跨环境稳定触发选择器）——
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一文件
    if (!f) return
    const isText = /\.(txt|md|markdown|json|csv|log|html?|xml|yml|yaml)$/i.test(f.name)
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name)
    const finish = (opts: { content?: string; preview?: string }) => {
      const node = api.add(f.name, 'doc', 'root', opts)
      onParticipate?.('add')
      setReaderId(node.id)
      flash(`已添加并打开：${f.name}`)
    }
    if (isText) {
      const r = new FileReader()
      r.onload = () => finish({ content: String(r.result ?? '') })
      r.readAsText(f)
    } else if (isImage) {
      const r = new FileReader()
      r.onload = () => finish({ preview: String(r.result ?? ''), content: `（已上传图片：${f.name}）\n\n图片内容将由 AI 在下一轮生成中实际识别与采纳；此处为预览。` })
      r.readAsDataURL(f)
    } else {
      finish({ content: `（已上传文件：${f.name}）\n\n该文件将在下一轮生成中由 AI 实际读取与采纳；此处展示占位内容。` })
    }
  }

  const chooseUrl = () => {
    setMenuOpen(false)
    setInlineMode('url')
  }
  const chooseText = () => {
    setMenuOpen(false)
    setInlineMode('text')
  }

  const submitUrl = () => {
    const v = urlVal.trim()
    if (!v) {
      flash('请粘贴一个链接')
      return
    }
    const node = api.add(v, 'url', 'root', {
      content: `（已记录链接：${v}）\n\n该链接内容将在下一轮生成中由 AI 实际抓取与采纳；此处展示占位内容。`,
    })
    onParticipate?.('add')
    setInlineMode(null)
    setUrlVal('')
    setReaderId(node.id)
    flash('已添加链接来源')
  }

  const submitText = () => {
    const v = textVal.trim()
    if (!v) {
      flash('请输入内容')
      return
    }
    const title = v.split(/\r?\n/)[0].slice(0, 24) || '用户输入文本'
    const node = api.add(title, 'user', 'root', { content: v })
    onParticipate?.('add')
    setInlineMode(null)
    setTextVal('')
    setReaderId(node.id)
    flash('已添加用户输入')
  }

  return (
    <div className={`tree ${highlight ? 'demo-highlight' : ''}`}>
      <div className="tree-head">
        <span>
          知识源树（F7）· 点击节点可阅读全文 · 可排除/启用/删除
          {touched.size > 0 && <span className="tree-hint"> · 你已参与 {touched.size} 次</span>}
        </span>
        <button className="mini" onClick={toggleCollapse}>
          {collapsed ? '▾ 展开' : '▴ 收起'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="tree-canvas">
            <svg width="100%" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="知识源思维导图">
              {sources.map((s) => {
                const p = layout.pos.get(s.id)
                if (!p) return null
                const parent = s.parentId ? layout.pos.get(s.parentId) : null
                if (!parent) return null
                const x1 = parent.x * COL_W + 30 + NODE_W
                const y1 = parent.y
                const x2 = p.x * COL_W + 30
                const y2 = p.y
                return (
                  <path
                    key={`e-${s.id}`}
                    className={`edge ${s.status}`}
                    d={`M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`}
                    fill="none"
                  />
                )
              })}
              {sources.map((s) => {
                const p = layout.pos.get(s.id)
                if (!p) return null
                const x = p.x * COL_W + 30
                const y = p.y - NODE_H / 2
                const isOpen = readerId === s.id
                return (
                  <g
                    key={s.id}
                    className={`node-g ${isOpen ? 'sel' : ''}`}
                    data-source-id={s.id}
                    onClick={() => setReaderId(isOpen ? null : s.id)}
                  >
                    <title>点击打开阅读：{s.title}</title>
                    <rect
                      className={`node ${s.status} ${isOpen ? 'sel' : ''}`}
                      x={x}
                      y={y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={9}
                    />
                    <text className="node-title" x={x + NODE_W / 2} y={p.y - 3} textAnchor="middle">
                      {s.title.length > 16 ? s.title.slice(0, 15) + '…' : s.title}
                    </text>
                    <text className="node-sub" x={x + NODE_W / 2} y={p.y + 12} textAnchor="middle">
                      {TYPE_LABEL[s.type] ?? s.type} · {Math.round((s.relevance ?? 0) * 100)}%
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* 添加来源：原生文件输入框（样式化为按钮，稳定触发系统文件选择器）；链接 / 文本为次级入口 */}
          <div className={`tree-add ${highlightAdd ? 'demo-highlight' : ''}`}>
            <input
              type="file"
              className="file-picker"
              accept=".pdf,.txt,.md,.markdown,.doc,.docx,.csv,.json,.html,.xml,.png,.jpg,.jpeg,.gif,.webp"
              onChange={onFile}
              onClick={(e) => {
                // 一键演示模式：拦截系统文件对话框，改弹模拟选择器，让「点击→选文件」过程可见
                if (demoFakePicker) {
                  e.preventDefault()
                  onFakeOpen?.()
                }
              }}
            />
            <button className="add-trigger ghost" onClick={() => setMenuOpen((o) => !o)}>
              其他：链接 / 文本 ▾
            </button>
            {menuOpen && (
              <div className="add-menu">
                <button onClick={chooseUrl}>
                  <span className="mi">🔗</span> 粘贴链接<span className="mi-sub">URL</span>
                </button>
                <button onClick={chooseText}>
                  <span className="mi">✍️</span> 输入文本<span className="mi-sub">直接粘贴内容</span>
                </button>
              </div>
            )}
            {inlineMode === 'url' && (
              <div className="add-inline">
                <input
                  autoFocus
                  placeholder="粘贴链接 URL…"
                  value={urlVal}
                  onChange={(e) => setUrlVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
                />
                <button className="mini primary" onClick={submitUrl}>添加</button>
                <button className="mini" onClick={() => setInlineMode(null)}>取消</button>
              </div>
            )}
            {inlineMode === 'text' && (
              <div className="add-inline">
                <textarea
                  autoFocus
                  placeholder="直接粘贴文本，将作为「用户输入」来源…"
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                />
                <div className="add-inline-actions">
                  <button className="mini primary" onClick={submitText}>添加</button>
                  <button className="mini" onClick={() => setInlineMode(null)}>取消</button>
                </div>
              </div>
            )}
          </div>
          {msg && <div className="tree-msg">{msg}</div>}
        </>
      )}

      {reader && <ReaderModal node={reader} onClose={() => setReaderId(null)} api={api} onParticipate={onParticipate} />}
    </div>
  )
}

function statusLabel(s: SourceNode['status']): string {
  return s === 'active' ? '启用中' : s === 'excluded' ? '已排除' : '待采纳'
}

/** 文档阅读器（居中文档页）：标题 + 元信息 + 目录 + 带阅读进度的排版正文。 */
function ReaderModal({
  node,
  onClose,
  api,
  onParticipate,
}: {
  node: SourceNode
  onClose: () => void
  api: SourcesApi
  onParticipate?: (op: string) => void
}) {
  const [readPct, setReadPct] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  // 每次打开都从文档顶部开始，避免保留上次滚动位置
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [node.id])
  const content = node.content ?? node.summary ?? '（该来源暂无可读内容）'
  const words = content.replace(/\s+/g, '').length
  const blocks = useMemo(() => parseBlocks(content), [content])
  const toc = blocks.map((b, i) => ({ b, i })).filter((x) => x.b.type === 'h')

  const onScroll = () => {
    const el = bodyRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setReadPct(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)))
  }

  const jumpTo = (i: number) => {
    const el = document.getElementById('blk-' + i)
    const box = bodyRef.current
    if (el && box) box.scrollTo({ top: Math.max(0, el.offsetTop - 6), behavior: 'smooth' })
  }

  // Portal 到 body：遮罩必须相对视口定位，否则会被 .stage-card 的 backdrop-filter
  // 变成包含块，在长卡片里垂直居中后顶部溢出视口（表现为「阅读器看不见上半部分」）
  return createPortal((
    <div
      className="reader-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="reader-page">
        <div className="reader-page-head">
          <div className="reader-fileicon">📄</div>
          <div className="reader-head-main">
            <div className="reader-title">{node.title}</div>
            <div className="reader-sub">
              <span className="badge soft">{TYPE_LABEL[node.type] ?? node.type}</span>
              <span className={`badge ${node.status}`}>{statusLabel(node.status)}</span>
              <span className="reader-rel">相关度 {Math.round((node.relevance ?? 0) * 100)}%</span>
            </div>
          </div>
          <button className="mini icon" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <div className="reader-metabar">
          <span>📖 知识源阅读 · 只读</span>
          <span className="dot">·</span>
          <span>字数 ≈ {words}</span>
          <span className="dot">·</span>
          <span>{node.status === 'active' ? 'AI 正在使用' : node.status === 'excluded' ? '已排除，不纳入' : '下一轮采纳'}</span>
        </div>

        <div className="reader-progress"><span style={{ width: `${readPct}%` }} /></div>

        {toc.length > 0 && (
          <div className="reader-toc">
            <span className="reader-toc-label">目录</span>
            {toc.map(({ b, i }) => (
              <button key={i} className="reader-toc-item" onClick={() => jumpTo(i)}>
                {b.text}
              </button>
            ))}
          </div>
        )}

        <div className="reader-body" ref={bodyRef} onScroll={onScroll}>
          {node.preview && <img className="reader-img" src={node.preview} alt="来源预览" />}
          <article className="reader-article">
            {blocks.map((b, idx) => {
              if (b.type === 'h') return <h4 key={idx} id={'blk-' + idx} className="reader-h">{b.text}</h4>
              if (b.type === 'ul')
                return (
                  <ul key={idx} className="reader-ul">
                    {b.items!.map((it, k) => (
                      <li key={k}>{it}</li>
                    ))}
                  </ul>
                )
              if (b.type === 'quote')
                return (
                  <blockquote key={idx} className="reader-quote">
                    {b.items!.map((it, k) => (
                      <div key={k}>{it}</div>
                    ))}
                  </blockquote>
                )
              return <p key={idx} className="reader-p">{b.text}</p>
            })}
          </article>
        </div>

        <div className="reader-actions">
          {node.status !== 'excluded' ? (
            <button
              className="mini"
              onClick={() => {
                api.exclude(node.id)
                onParticipate?.('exclude')
              }}
            >
              ⛔ 排除此来源
            </button>
          ) : (
            <button
              className="mini"
              onClick={() => {
                api.include(node.id)
                onParticipate?.('include')
              }}
            >
              ✓ 重新启用
            </button>
          )}
          <button
            className="mini danger"
            onClick={() => {
              api.remove(node.id)
              onParticipate?.('remove')
              onClose()
            }}
          >
            🗑 删除
          </button>
        </div>
        <div className="reader-note">阅读模式 · 源不可编辑（守住可信）；可排除/启用/删除，或下方实时添加新来源。</div>
      </div>
    </div>
  ), document.body)
}

type Block = { type: 'h' | 'p' | 'ul' | 'quote'; items?: string[]; text?: string }

/** 轻量文档解析：标题 / 段落 / 列表 / 引用，让正文像文档而非巨长文本框。 */
function parseBlocks(content: string): Block[] {
  const lines = content.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''))
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i++
      continue
    }
    if (/^#{1,4}\s/.test(line)) {
      blocks.push({ type: 'h', text: line.replace(/^#{1,4}\s/, '') })
      i++
    } else if (line.length < 36 && /[：:]\s*$/.test(line)) {
      blocks.push({ type: 'h', text: line })
      i++
    } else if (/^[·•\-]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[·•\-]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[·•\-]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
    } else if (/^[“"『「]/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[“"『「]/.test(lines[i].trim())) {
        items.push(lines[i].trim())
        i++
      }
      blocks.push({ type: 'quote', items })
    } else {
      // 连续普通行合并为一个段落，保留换行
      const para: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^#{1,4}\s/.test(lines[i].trim()) &&
        !/^[·•\-]\s+/.test(lines[i].trim()) &&
        !/^[“"『「]/.test(lines[i].trim()) &&
        !(lines[i].trim().length < 36 && /[：:]\s*$/.test(lines[i].trim()))
      ) {
        para.push(lines[i].trim())
        i++
      }
      blocks.push({ type: 'p', text: para.join('\n') })
    }
  }
  return blocks
}

