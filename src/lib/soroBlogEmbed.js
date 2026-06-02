/** Soro blog embed — loaded at most once per page session. */
export const SORO_BLOG_EMBED_SRC =
  'https://app.trysoro.com/api/embed/23505f15-324f-4f46-abc9-6ad28f890944'

const SCRIPT_SELECTOR = `script[data-smh-soro-blog="1"]`

/**
 * Appends the Soro embed script to document.body if it is not already present.
 */
export function loadSoroBlogEmbedScript() {
  if (typeof document === 'undefined') return
  if (document.querySelector(SCRIPT_SELECTOR)) return

  const script = document.createElement('script')
  script.src = SORO_BLOG_EMBED_SRC
  script.defer = true
  script.setAttribute('data-smh-soro-blog', '1')
  document.body.appendChild(script)
}
