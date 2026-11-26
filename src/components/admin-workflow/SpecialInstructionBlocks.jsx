/**
 * @param {{ customer?: string, admin?: string, text?: string, emptyLabel?: string }} props
 */
export default function SpecialInstructionBlocks({ customer = '', admin = '', text = '', emptyLabel = 'None' }) {
  const blocks = []
  const customerText = String(customer || '').trim()
  const adminText = String(admin || '').trim()
  if (customerText || adminText) {
    if (customerText) blocks.push({ label: 'Added by customer', text: customerText })
    if (adminText) blocks.push({ label: 'Added by admin', text: adminText })
  } else {
    const parsed = parseLabeledBlocks(text)
    blocks.push(...parsed)
  }

  if (!blocks.length) {
    const plain = String(text || '').trim()
    if (!plain) {
      if (!emptyLabel) return null
      return <p className="mt-1 text-sm text-slate-700">{emptyLabel}</p>
    }
    return <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{plain}</p>
  }

  return (
    <div className="mt-1 space-y-2">
      {blocks.map((block) => (
        <div key={block.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-bold text-slate-500">{block.label}:</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{block.text}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * @param {unknown} text
 */
function parseLabeledBlocks(text) {
  const lines = String(text || '')
    .replace(/\s*·\s*/g, '\n')
    .split('\n')
  /** @type {Array<{ label: string, lines: string[] }>} */
  const blocks = []
  let current = null
  for (const line of lines) {
    const customer = line.trim().match(/^Added by customer:\s*$/i)
    const admin = line.trim().match(/^Added by admin:\s*$/i)
    if (customer || admin) {
      current = { label: customer ? 'Added by customer' : 'Added by admin', lines: [] }
      blocks.push(current)
      continue
    }
    if (current) current.lines.push(line)
  }
  return blocks
    .map((block) => ({ label: block.label, text: block.lines.join('\n').trim() }))
    .filter((block) => block.text)
}
