/**
 * Node ESM loader: resolve extensionless relative imports to .js (matches Vite src layout).
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
