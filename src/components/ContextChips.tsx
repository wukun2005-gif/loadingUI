interface Chip {
  id: string
  label: string
  tone?: string
}

interface Props {
  chips: Chip[]
  highlight?: boolean
}

export function ContextChips({ chips, highlight }: Props) {
  if (chips.length === 0) return null
  return (
    <div className={`chips ${highlight ? 'demo-highlight' : ''}`} aria-label="上下文微信息">
      {chips.map((c) => (
        <span key={c.id} className={`chip ${c.tone ?? 'neutral'}`}>
          {c.label}
        </span>
      ))}
    </div>
  )
}
