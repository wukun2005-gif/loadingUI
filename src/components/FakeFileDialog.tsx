import { useEffect, useState } from 'react'

/**
 * 一键演示用「模拟系统文件选择器」（F7 上传全流程）。
 * 目的：把「点击上传 → 选择文件 → 前端读取 → 即时入树」的过程完整演给用户看，
 * 而不是一步就把文件塞进知识源树。
 * 真实产品中此处是系统文件对话框；演示环境用此弹窗代替（避免弹出系统框打断自动演示）。
 */
interface Props {
  phase: 'pick' | 'reading'
  /** 用户点选某个文件（进入读取态） */
  onPick: () => void
  /** 前端读取完成，可真正入树 */
  onDone: () => void
  onCancel: () => void
}

const FILES = [
  { name: '2025 内部增长复盘.pdf', meta: 'PDF · 1.2 MB', ico: '📄' },
  { name: '产品路线图 v3.docx', meta: 'Word · 860 KB', ico: '📝' },
  { name: '竞品分析报告.png', meta: '图片 · 3.4 MB', ico: '🖼' },
  { name: '会议纪要-0715.md', meta: '文本 · 24 KB', ico: '📄' },
]

export function FakeFileDialog({ phase, onPick, onDone, onCancel }: Props) {
  const [sel, setSel] = useState<string | null>(null)

  // 读取态：进度条动画约 1.8s，结束后回调「真正入树」
  useEffect(() => {
    if (phase !== 'reading') return
    const t = window.setTimeout(() => onDone(), 1800)
    return () => window.clearTimeout(t)
  }, [phase, onDone])

  return (
    <div className="fake-dialog" role="dialog" aria-modal="true" aria-label="选择要上传的文件">
      <div className="fake-dialog-box">
        <div className="fake-dialog-titlebar">
          <span>📂 打开 · 选择要上传的文件</span>
          <button className="mini icon" onClick={onCancel} aria-label="关闭">×</button>
        </div>

        {phase === 'pick' ? (
          <>
            <div className="fake-dialog-path">~/Documents/团队材料</div>
            <div className="fake-dialog-list">
              {FILES.map((f) => (
                <button
                  key={f.name}
                  className={`fake-file-row ${sel === f.name ? 'sel' : ''}`}
                  data-fake-file={f.name}
                  onClick={() => {
                    setSel(f.name)
                    onPick()
                  }}
                >
                  <span className="fake-file-ico">{f.ico}</span>
                  <span className="fake-file-name">{f.name}</span>
                  <span className="fake-file-meta">{f.meta}</span>
                </button>
              ))}
            </div>
            <div className="fake-dialog-actions">
              <button className="mini" onClick={onCancel}>取消</button>
              <button className="mini primary" disabled={!sel} onClick={() => sel && (setSel(sel), onPick())}>
                打开
              </button>
            </div>
            <div className="fake-dialog-note">演示环境以模拟选择器代替系统文件对话框；交互与真实产品一致。</div>
          </>
        ) : (
          <div className="fake-dialog-reading">
            <div className="fake-reading-file">✓ 已选择：{sel ?? '2025 内部增长复盘.pdf'}</div>
            <div className="fake-reading-bar"><span /></div>
            <div className="fake-reading-text">前端正在读取文件内容…</div>
          </div>
        )}
      </div>
    </div>
  )
}
