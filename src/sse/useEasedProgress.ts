import { useEffect, useRef, useState } from 'react'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

// 缓动仅视觉：真实百分比由 progress_update 事件驱动（PRD §缓动 vs 忠实性）。
// 「先慢后快」：对目标百分比做凸曲线映射，早期缓慢、后期加速；永不在 99% 卡住。
function easeSlowStart(p: number): number {
  const c = Math.max(0, Math.min(100, p))
  return 100 * Math.pow(c / 100, 1.35)
}

export function useEasedProgress(target: number, opts?: { reduced?: boolean }): number {
  const [display, setDisplay] = useState(0)
  const cur = useRef(0)
  const tgt = useRef(target)
  const prevTgt = useRef(target)
  tgt.current = target

  useEffect(() => {
    if (opts?.reduced) {
      cur.current = easeSlowStart(tgt.current)
      setDisplay(cur.current)
      return
    }
    let raf = 0
    const tick = () => {
      const mapped = easeSlowStart(tgt.current)
      // 目标值明显回退 = 流被重置（切换降级档位 / 重跑 / 新一轮场景）：
      // 立即对齐到新值，绝不向后缓动——进度条「倒退」会让用户误以为任务回滚。
      if (tgt.current < prevTgt.current - 2) {
        cur.current = mapped
      } else {
        cur.current += (mapped - cur.current) * 0.07
        if (Math.abs(mapped - cur.current) < 0.15) cur.current = mapped
      }
      prevTgt.current = tgt.current
      setDisplay(cur.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [opts?.reduced])

  return display
}
