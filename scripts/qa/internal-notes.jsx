import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { NoteInterneSection } from '@/components/clienti/note-interne-section'
import { PermissionProvider } from '@/lib/permissions/provider'
import { buildDefaultPermissionSnapshot } from '@/lib/permissions/constants'
import '@/app/globals.css'

function Harness() {
  const [role, setRole] = useState('SUPERADMIN')
  const [fail, setFail] = useState(false), [warning, setWarning] = useState(false)
  const [state, setState] = useState(null), [revision, setRevision] = useState(0)
  async function config(f, w) { await fetch('/qa-api/config', { method: 'POST', body: JSON.stringify({ fail: f, warning: w }) }); setFail(f); setWarning(w) }
  return <main className="mx-auto max-w-3xl p-6 space-y-4">
    <h1 className="text-2xl font-bold">Collaudo menzioni interne</h1>
    <p>Dati fittizi. Nessun collegamento al CRM o SMTP.</p>
    <label className="block"><input type="checkbox" checked={fail} onChange={(e) => config(e.target.checked, warning)} /> Simula errore salvataggio</label>
    <label className="block"><input type="checkbox" checked={warning} onChange={(e) => config(fail, e.target.checked)} /> Simula errore email</label>
    <label className="block">Ruolo <select value={role} onChange={(e) => setRole(e.target.value)}><option>SUPERADMIN</option><option>AGENT</option></select></label>
    <button className="border p-2" onClick={() => setRevision((r) => r + 1)}>Ricarica note</button>
    <button className="border p-2" onClick={async () => setState(await (await fetch('/qa-api/state')).json())}>Leggi dati salvati</button>
    <PermissionProvider snapshot={buildDefaultPermissionSnapshot({ ruoloCode: role, userId: 'author', nome: 'Autore Test' })}>
      <NoteInterneSection key={`${role}-${revision}`} clienteId="test" />
    </PermissionProvider>
    {state ? <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(state, null, 2)}</pre> : null}
    <Toaster />
  </main>
}
createRoot(document.getElementById('root')).render(<Harness />)
