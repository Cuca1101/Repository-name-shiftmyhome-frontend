import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DOCUMENT_CSP, DOCUMENT_PERMISSIONS } from './functions/_shared/documentSecurity.js'
import { adminApiDevPlugin } from './scripts/vite-admin-api-plugin.js'

const securityHeaders = {
  'Content-Security-Policy': DOCUMENT_CSP,
  'Permissions-Policy': DOCUMENT_PERMISSIONS,
}

function documentSecurityPlugin() {
  return {
    name: 'document-security',
    transformIndexHtml(html) {
      if (html.includes('http-equiv="Content-Security-Policy"')) return html
      const meta = `    <meta http-equiv="Content-Security-Policy" content="${DOCUMENT_CSP}" />`
      return html.replace('<head>', `<head>\n${meta}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), documentSecurityPlugin(), adminApiDevPlugin(process.cwd())],
  server: { headers: securityHeaders },
  preview: { headers: securityHeaders },
})
