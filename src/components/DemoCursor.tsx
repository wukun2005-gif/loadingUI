import { useEffect, useState } from 'react'

interface Props {
  /** 目标元素选择器；null 表示隐藏光标 */
  target: string | null
  /** 是否播放「点击」涟漪 */
  clicking?: boolean
}

/**
 * 演示用模拟鼠标：移动到目标元素中心并点击。
 * 目的：让「点哪里、点了什么」在演示中真实可见，而不是只在解说里说一句。
 */
export function DemoCursor({ target, clicking }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!target) {
      setPos(null)
      return
    }
    const update = () => {
      const el = document.querySelector(target)
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      setPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    // 目标可能要等 DOM 更新 / 滚动结束后才就位，多试几次
    const timers = [120, 420, 800].map((ms) => window.setTimeout(update, ms))
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      timers.forEach(window.clearTimeout)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [target])

  if (!pos) return null

  return (
    <div
      className="demo-cursor"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      aria-hidden="true"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.6 L12 14 L19 14 Z"
          fill="#0b0e14"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {clicking && <span className="demo-cursor-ring" />}
    </div>
  )
}
