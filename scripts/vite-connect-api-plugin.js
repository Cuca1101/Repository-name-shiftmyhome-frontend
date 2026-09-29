import fs from 'node:fs'
import path from 'node:path'
import { onRequest as contacts } from '../functions/api/admin/connect/contacts.js'
import { onRequest as recordings } from '../functions/api/admin/connect/recordings.js'

const ROUTES = new Map([
  ['/api/admin/connect/contacts', contacts],
  ['/api/admin/connect/recordings', recordings],
])

function loadDevVars(root) {
  const env = {}
  const file = path.join(root, '.dev.vars')
  if (!fs.existsSync(file)) return env
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

/**
 * Run the Cloudflare Pages call-history functions during Vite dev and preview.
 * @param {string} root
 */
export function connectApiDevPlugin(root) {
  const env = loadDevVars(root)
  /** @type {import('connect').NextHandleFunction} */
  async function handle(req, res, next) {
    const pathname = String(req.url || '').split('?')[0]
    const handler = ROUTES.get(pathname)
    if (!handler) {
      next()
      return
    }
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const body = Buffer.concat(chunks)
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
        else if (value != null) headers.set(key, String(value))
      }
      const host = req.headers.host || 'localhost'
      const method = req.method || 'GET'
      const request = new Request(`http://${host}${req.url || pathname}`, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
      })
      const response = await handler({ request, env })
      res.statusCode = response.status
      response.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'private, no-store')
      }
      res.end(JSON.stringify({ message: 'Could not load call history.' }))
    }
  }

  return {
    name: 'connect-api-dev',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
