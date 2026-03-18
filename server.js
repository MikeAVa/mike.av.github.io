import http from 'http'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const isProd = process.env.NODE_ENV === 'production'
const port = process.env.PORT || 3000

const serverBundle = path.resolve('dist-ssr', 'entry-server.js')
const clientManifestPath = path.resolve('dist', 'ssr-manifest.json')

let clientManifest = null
try {
  if (fs.existsSync(clientManifestPath)) {
    clientManifest = JSON.parse(fs.readFileSync(clientManifestPath, 'utf-8'))
  }
} catch (e) {
  console.warn('Could not read client SSR manifest:', e)
}

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

let viteDevServer = null
let prodRenderFn = null

if (!isProd) {
  // Development: create Vite dev server in middleware (SSR) mode
  const { createServer: createViteServer } = await import('vite')
  viteDevServer = await createViteServer({
    server: { middlewareMode: 'ssr' },
    appType: 'custom',
    root: process.cwd(),
  })
} else {
  // Production: import the pre-built server bundle
  try {
    const mod = await import(pathToFileURL(serverBundle).href)
    prodRenderFn = mod.render || mod.default
  } catch (e) {
    console.error('Failed to load server bundle. Did you run `npm run build:server`?')
    console.error(e)
    process.exit(1)
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = req.url || '/'

    if (!isProd && viteDevServer) {
      // Let Vite's middleware handle requests for static assets and HMR
      await new Promise((resolve, reject) => {
        viteDevServer.middlewares(req, res, (err) => (err ? reject(err) : resolve()))
      })
      if (res.writableEnded) return

      // Load server entry via Vite (enables HMR and transforms)
      const mod = await viteDevServer.ssrLoadModule('/src/entry-server.tsx')
      const renderFn = mod.render || mod.default
      const html = await renderFn(reqUrl)

      // Inject Vite HMR client and transform HTML
      const finalHtml = await viteDevServer.transformIndexHtml(reqUrl, html)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(finalHtml)
      return
    }

    // Try to serve static assets from `dist` first (production)
    const urlPath = decodeURIComponent(reqUrl.split('?')[0].replace(/^\//, ''))
    const filePath = path.resolve('dist', urlPath || 'index.html')
    if (fs.existsSync(filePath) && filePath.startsWith(path.resolve('dist'))) {
      const ext = path.extname(filePath) || '.html'
      const type = mime[ext] || 'application/octet-stream'

      // Cache policy: long-lived for fingerprinted assets, short/no-cache for HTML
      const longLived = ['.js', '.css', '.png', '.jpg', '.svg', '.ico', '.json', '.woff', '.woff2', '.ttf']
      const cacheControl = ext === '.html'
        ? 'no-cache'
        : longLived.includes(ext)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600'

      const stream = fs.createReadStream(filePath)
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cacheControl })
      stream.pipe(res)
      return
    }

    // Fallback to server rendering (production path)
    const html = await prodRenderFn(reqUrl, clientManifest)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  } catch (err) {
    console.error(err)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

server.listen(port, () => {
  console.log(`SSR server running at http://localhost:${port} (prod=${isProd})`)
})
