import { highlightInventorySegments } from './inventorySearchUtils'

export default function HighlightedInventoryName({ name, query }) {
  const segments = highlightInventorySegments(name, query)
  return (
    <span className="break-words">
      {segments.map((s, i) =>
        s.hl ? (
          <mark key={i} className="rounded bg-amber-200/90 px-0.5 text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  )
}
