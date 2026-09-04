// Isolated UI harness: real components, fake references and an in-memory API.
// No Next server, .env loading, SMTP or Supabase. Never deploy this harness.
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const vitestRequire = createRequire(require.resolve('vitest/package.json'))
const { createServer } = await import(pathToFileURL(vitestRequire.resolve('vite')).href)
const root = fileURLToPath(new URL('../../', import.meta.url))
let saved = { 'Data sopralluogo': '2026-09-04T00:00:00+00:00', Stato: 'Attesa cliente', 'custom:extra': 12.5, 'custom:note_extra': 'Valore iniziale', 'custom:giorno': '2026-09-04' }
let lastCreated = null
const server = await createServer({
  configFile: false, root, envDir: false,
  resolve: { alias: { '@': root, 'next/navigation': resolve(root, 'scripts/qa/ui-navigation.js') } },
  server: { host: '127.0.0.1', port: 4179, strictPort: true },
  plugins: [{ name: 'isolated-report-api', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/qa-api/')) return next()
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'GET') return res.end(JSON.stringify({ saved, lastCreated }))
      let body = ''; for await (const chunk of req) body += chunk
      const patch = JSON.parse(body)
      if (req.url.endsWith('/fail')) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Errore simulato: dati non salvati' })) }
      if (req.url.endsWith('/create')) lastCreated = patch
      else saved = { ...saved, ...patch }
      res.end(JSON.stringify({ ok: true, saved }))
    })
  } }],
})
await server.listen()
console.log('Isolated report UI: http://127.0.0.1:4179/scripts/qa/ui.html')
