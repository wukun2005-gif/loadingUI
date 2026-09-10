import type { StageId } from '../types/sse'

// F4 环境氛围层：4 阶段独立色调，阶段切换 2s 平滑过渡，呼吸动画 4s。
const HUE: Record<StageId, number> = {
  retrieving: 205, // 蓝
  analyzing: 265, // 紫
  synthesizing: 160, // 青绿
  finalizing: 35, // 琥珀
}

interface Props {
  stage?: StageId
  reduced: boolean
}

export function AmbientLayer({ stage, reduced }: Props) {
  const hue = stage ? HUE[stage] : 220
  return (
    <div
      className="ambient"
      style={{
        ['--hue' as string]: hue,
        animationDuration: reduced ? '0s' : '4s',
      }}
    />
  )
}
