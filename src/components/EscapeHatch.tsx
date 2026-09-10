import { useEffect, useState } from 'react'
import { track } from '../analytics/metrics'

// F6 四级逃生舱：开始推理即显示；取消需二次确认；后台运行有通知回调。
interface Props {
  done: boolean
  /** 每次（重新）发起流时递增：新一轮开始即重新显示逃生舱 */
  runId?: number
  onCancel: () => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
  highlight?: boolean
  /** 强制可见（一键演示用，例如已手动转入后台后仍需演示） */
  forceVisible?: boolean
}

export function EscapeHatch({ done, runId, onCancel, open: openProp, onOpenChange, highlight, forceVisible }: Props) {
  const [visible, setVisible] = useState(true)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onOpenChange?.(v)
  }
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (done) {
      setVisible(false)
      setOpen(false)
      return
    }
    // 开始推理即显示逃生舱：等待期间用户随时可中断 / 转后台，不再等 10 秒
    setVisible(true)
    // runId 变化（含运行中直接重跑）也要重新出现
  }, [done, runId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // 隐藏时仍保留 toast 反馈（如「已转入后台运行」）
  if (!visible && !forceVisible) {
    return toast ? <div className="hatch-toast">{toast}</div> : null
  }

  const confirmCancel = () => {
    if (window.confirm('确认取消本次生成？已进行的思考将被丢弃。')) {
      track('thinking_abandon', { via: 'cancel' })
      setOpen(false)
      setToast('已取消，后台任务已通知终止')
      onCancel()
    }
  }

  return (
    <>
      <div className={`hatch ${highlight ? 'demo-highlight' : ''}`}>
        <button className="hatch-btn" onClick={() => setOpen(!open)}>
          ⌘ 逃生舱
        </button>
        {open && (
          <div className="hatch-menu">
            <button className="hatch-item" title="静音并收起思考态" onClick={() => { setToast('已静音并收起思考态'); setOpen(false) }}>
              <span className="h-ico">🔇</span><span>① 静音收起</span>
            </button>
            <button className="hatch-item" title="转入后台运行，完成时通知你" onClick={() => { setToast('已转入后台运行，完成时通知你'); setOpen(false); setVisible(false) }}>
              <span className="h-ico">⏳</span><span>② 后台运行</span>
            </button>
            <button className="hatch-item warn" title="取消本次生成（二次确认）" onClick={confirmCancel}>
              <span className="h-ico">✕</span><span>③ 取消</span>
            </button>
            <button className="hatch-item danger" title="紧急停止并丢弃所有结果" onClick={() => { if (window.confirm('紧急停止并丢弃所有结果？')) { track('thinking_abandon', { via: 'emergency' }); setOpen(false); setToast('已紧急停止'); onCancel() } }}>
              <span className="h-ico">⛔</span><span>④ 紧急停止</span>
            </button>
          </div>
        )}
      </div>
      {toast && <div className="hatch-toast">{toast}</div>}
    </>
  )
}
