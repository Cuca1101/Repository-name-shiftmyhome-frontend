/**
 * Node ESM loader: resolve extensionless relative imports to .js (matches Vite src layout)
 * and give Vite's `import.meta.env` a plain object so Node tests can import src modules.
 * @param {string} specifier
 * @param {{ parentURL?: string }} context
 * @param {(specifier: string, context: object) => Promise<{ url: string }>} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
  if (
    context.parentURL &&
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !specifier.endsWith('.js') &&
    !specifier.endsWith('.json')
  ) {
    try {
      return await nextResolve(`${specifier}.js`, context)
    } catch {
      /* fall through */
    }
  }
  return nextResolve(specifier, context)
}

/**
 * @param {string} url
 * @param {{ format?: string }} context
 * @param {(url: string, context: object) => Promise<{ format?: string, source?: string | Uint8Array }>} nextLoad
 */
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  const projectFile = url.startsWith('file:') && (url.includes('/src/') || url.includes('/scripts/'))
  if (!projectFile || (result.format && result.format !== 'module')) return result
  const source = result.source == null ? '' : `${result.source}`
  if (!source.includes('import.meta.env')) return result
  return {
    format: 'module',
    shortCircuit: true,
    source: source.replaceAll(
      'import.meta.env',
      '(globalThis.__SMH_IMPORT_META_ENV || (globalThis.__SMH_IMPORT_META_ENV = {}))',
    ),
  }
}
