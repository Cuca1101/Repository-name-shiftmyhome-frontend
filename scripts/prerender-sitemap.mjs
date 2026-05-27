import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

async function findFreePort(start = 4173, end = 4200) {
  for (let port = start; port <= end; port++) {
    const free = await new Promise((resolve) => {
      const server = net.createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close(() => resolve(true))
      })
      server.listen(port, '127.0.0.1')
    })
    if (free) return port
  }
  throw new Error(`No free port found between ${start} and ${end}`)
}

async function waitForHttpOk(url, timeoutMs = 20000) {
  const started = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (res.ok) return
    } catch {
      // ignore until timeout
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Preview server did not become ready in ${timeoutMs}ms (${url})`)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
}

function readSitemapPaths() {
  const xml = fs.readFileSync('public/sitemap.xml', 'utf8')
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter(Boolean)
  return urls
    .map((u) => {
      try {
        return new URL(u).pathname || '/'
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function distIndexPathForRoute(routePath) {
  const clean = routePath === '/' ? '/' : routePath.replace(/\/+$/, '')
  if (clean === '/') return path.join('dist', 'index.html')
  return path.join('dist', clean.replace(/^\//, ''), 'index.html')
}

function startPreviewServer(port = 4173) {
  const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(
    process.execPath,
    [viteBin, 'preview', '--strictPort', '--port', String(port)],
    { stdio: 'pipe', shell: false },
  )

  return new Promise((resolve, reject) => {
    let settled = false
    const onData = (chunk) => {
      // keep stdout/stderr attached for debugging, but don't rely on output format
      void chunk
    }
    const stderr = []
    const stdout = []
    child.stdout.on('data', (c) => {
      stdout.push(String(c || ''))
      onData(c)
    })
    child.stderr.on('data', (c) => {
      stderr.push(String(c || ''))
      onData(c)
    })
    child.on('error', (e) => {
      if (!settled) {
        settled = true
        reject(e)
      }
    })
    child.on('exit', (code) => {
      if (!settled) {
        settled = true
        reject(new Error(`vite preview exited early (code ${code})\n\nstdout:\n${stdout.join('')}\n\nstderr:\n${stderr.join('')}`))
      }
    })

    // Resolve after server responds on HTTP.
    ;(async () => {
      try {
        await waitForHttpOk(`http://127.0.0.1:${port}/`)
        if (!settled) {
          settled = true
          resolve(child)
        }
      } catch (e) {
        if (!settled) {
          settled = true
          reject(e)
        }
      }
    })()
  })
}

async function prerenderAll() {
  const port = await findFreePort()
  const base = `http://127.0.0.1:${port}`
  console.log(`[prerender] Using preview port ${port}`)
  const routes = readSitemapPaths()

  const server = await startPreviewServer(port)
  const browser = await chromium.launch()
  const context = await browser.newContext()

  try {
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]
      const url = `${base}${route}`
      const page = await context.newPage()

      try {
        await page.goto(url, { waitUntil: 'networkidle' })

        // Wait for canonical to match the current path (set by SeoHead effect).
        await page.waitForFunction(
          () => {
            const canonical = document.querySelector('link[rel=\"canonical\"]')
            if (!canonical) return false
            const href = canonical.getAttribute('href') || ''
            // canonical is absolute, includes pathname
            return href.includes(window.location.pathname)
          },
          { timeout: 15000 },
        )

        const html = await page.content()
        const outPath = distIndexPathForRoute(route)
        ensureDir(path.dirname(outPath))
        fs.writeFileSync(outPath, html, 'utf8')
      } catch (e) {
        console.error(`[prerender] Failed ${route}: ${String(e)}`)
        // Keep going; report will show issues.
      } finally {
        await page.close().catch(() => {})
      }
    }
  } finally {
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
    server.kill()
  }
}

await prerenderAll()
