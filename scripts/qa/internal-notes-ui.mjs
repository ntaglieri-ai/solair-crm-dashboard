// Componenti reali, API in memoria. Non carica .env e non invia email.
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const vitestRequire = createRequire(require.resolve('vitest/package.json'))
const { createServer } = await import(pathToFileURL(vitestRequire.resolve('vite')).href)
const root = fileURLToPath(new URL('../../', import.meta.url))
const user = { id: '11111111-1111-4111-8111-111111111111', nome: 'Mario Direttore' }
let notes = [], fail = false, warning = false, lastRequest = null
const server = await createServer({
  configFile: false, root, envDir: false,
  resolve: { alias: { '@': root, 'next/navigation': resolve(root, 'scripts/qa/ui-navigation.js') } },
  server: { host: '127.0.0.1', port: 4180, strictPort: true },
  plugins: [{ name: 'isolated-internal-notes', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/') && !req.url?.startsWith('/qa-api/')) return next()
      res.setHeader('Content-Type', 'application/json')
      const send = (value) => res.end(JSON.stringify(value))
      if (req.url.endsWith('/mention-users')) return send({ users: [user] })
      if (req.url === '/qa-api/state') return send({ notes, lastRequest })
      if (req.method === 'GET') return send({ note: notes })
      let raw = ''; for await (const chunk of req) raw += chunk
      const body = raw ? JSON.parse(raw) : {}
      if (req.url === '/qa-api/config') { fail = body.fail; warning = body.warning; return send({ ok: true }) }
      if (fail) { res.statusCode = 400; return send({ error: 'Errore simulato: nota non salvata' }) }
      lastRequest = { method: req.method, ...body }
      const menzioni = (body.menzioni ?? []).map((m) => ({ ...m, name: user.nome }))
      if (req.method === 'POST') {
        const note = { id: String(notes.length + 1), contenuto: body.contenuto, menzioni, creato_da: 'author', creato_da_nome: 'Autore Test', creato_il: new Date().toISOString(), modificato_da: null, modificato_il: null, modificato_da_nome: null }
        notes.unshift(note); res.statusCode = 201; return send({ ...note, notificationFailures: warning ? 1 : 0 })
      }
      const id = req.url.split('/').pop()
      if (req.method === 'DELETE') { notes = notes.filter((n) => n.id !== id); return send({ ok: true }) }
      const modificato_il = new Date().toISOString()
      notes = notes.map((n) => n.id === id ? { ...n, contenuto: body.contenuto, menzioni, modificato_il, modificato_da_nome: 'Autore Test' } : n)
      send({ ok: true, contenuto: body.contenuto, menzioni, modificato_il, notificationFailures: warning ? 1 : 0 })
    })
  } }],
})
await server.listen()
console.log('Isolated internal notes: http://127.0.0.1:4180/scripts/qa/internal-notes.html')
