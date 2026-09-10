import { useCallback, useEffect, useRef, useState } from 'react'
import type { StageId } from '../types/sse'

// F16 声音 / 触觉反馈：
// · 阶段切换时播放极弱的合成音效（WebAudio，无音频资源）；
// · 触觉（navigator.vibrate）仅在触屏设备生效，桌面端永不振动；
// · 音效默认关闭、可随时开关并持久化；尊重浏览器自动播放策略（首次点击后解锁）。

const STORE_KEY = 'synthesis_sound_on'
const STAGE_FREQ: Record<StageId, number> = {
  retrieving: 440,
  analyzing: 523.25,
  synthesizing: 659.25,
  finalizing: 783.99,
}

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function useFeedback() {
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try { return localStorage.getItem(STORE_KEY) === '1' } catch { return false }
  })
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback((): AudioContext | null => {
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        ctxRef.current = new AC()
      }
      if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
      return ctxRef.current
    } catch {
      return null
    }
  }, [])

  // 首次用户手势时解锁音频（浏览器自动播放策略）
  useEffect(() => {
    const unlock = () => getCtx()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [getCtx])

  const blip = useCallback((freq: number, durMs = 110, when = 0, gainPeak = 0.045) => {
    if (!soundRef.current) return
    const ctx = getCtx()
    if (!ctx) return
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + durMs / 1000 + 0.02)
  }, [getCtx])

  const notifyStage = useCallback((stage: StageId) => {
    blip(STAGE_FREQ[stage])
    if (isCoarsePointer() && 'vibrate' in navigator) {
      try { navigator.vibrate(12) } catch { /* 忽略 */ }
    }
  }, [blip])

  const notifyComplete = useCallback(() => {
    // 上行两音，提示完成
    blip(659.25, 120)
    blip(880, 160, 0.12)
    if (isCoarsePointer() && 'vibrate' in navigator) {
      try { navigator.vibrate([10, 40, 10]) } catch { /* 忽略 */ }
    }
  }, [blip])

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on
      try { localStorage.setItem(STORE_KEY, next ? '1' : '0') } catch { /* 忽略 */ }
      if (next) {
        // 打开瞬间给一个轻反馈音，让用户确认「声音已开」
        soundRef.current = true
        setTimeout(() => blip(587.33, 100), 0)
      }
      return next
    })
  }, [blip])

  // 受控设置（一键演示用，保证演示状态确定）
  const setSound = useCallback((on: boolean) => {
    soundRef.current = on
    try { localStorage.setItem(STORE_KEY, on ? '1' : '0') } catch { /* 忽略 */ }
    setSoundOn(on)
    if (on) setTimeout(() => blip(587.33, 100), 0)
  }, [blip])

  return { soundOn, toggleSound, setSound, notifyStage, notifyComplete }
}
