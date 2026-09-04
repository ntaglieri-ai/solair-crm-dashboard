import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { EditRecordDialog, buildClienteEditFields } from '@/components/shared/edit-record-dialog'
import { NewClienteDialog } from '@/components/clienti/new-cliente-dialog'
import { ClienteTagProvider } from '@/lib/cliente-tag-store'
import { ClienteCell } from '@/components/clienti/cliente-cell'
import '@/app/globals.css'

const installers = [{ id: '00000000-0000-4000-8000-000000000011', nome: 'Installatore di collaudo' }]
const owners = [{ id: '00000000-0000-4000-8000-000000000012', nome: 'Proprietario di collaudo' }]
const refs = { tags: [], clienteTagIds: {}, owners, ownerNames: {}, installers, installerNames: [] }
const permissions = { canField: () => true }

function Harness() {
  const [open, setOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [fail, setFail] = useState(false)
  const [data, setData] = useState({ saved: {} })
  async function reload() { setData(await (await fetch('/qa-api/state')).json()) }
  useEffect(() => {
    let active = true
    fetch('/qa-api/state').then((response) => response.json()).then((result) => { if (active) setData(result) })
    return () => { active = false }
  }, [])
  const cliente = { ...data.saved, customFields: [
    { key: 'extra', column: 'extra', label: 'Potenza extra', tipo: 'number', value: data.saved['custom:extra'] },
    { key: 'note_extra', column: 'note_extra', label: 'Note personalizzate', tipo: 'textarea', value: data.saved['custom:note_extra'] },
    { key: 'giorno', column: 'giorno', label: 'Giorno personalizzato', tipo: 'date', value: data.saved['custom:giorno'] },
  ] }
  const fields = buildClienteEditFields(cliente, permissions, installers).filter((f) => ['Data sopralluogo', 'Stato', 'InstallatoreId'].includes(f.key) || f.custom)
  return <ClienteTagProvider initialData={refs}>
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Collaudo isolato report Vito</h1>
      <p>Dati fittizi. Nessun collegamento al CRM reale.</p>
      <div style={{ width: 180 }} className="border p-2">
        <ClienteCell cliente={{ id: 'test', 'Nome Clienti': 'Cliente con denominazione molto lunga da leggere completamente senza troncamento e CodiceAziendaleLunghissimoSenzaSpazi123456789', 'E-mail': '', Tag: [] }} column="Nome Clienti" />
      </div>
      <label className="block"><input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Simula errore salvataggio</label>
      <button className="border rounded p-2 mr-4" onClick={() => setOpen(true)}>Modifica scheda test</button>
      <button className="border rounded p-2" onClick={() => setNewOpen(true)}>Nuovo cliente test</button>
      <h2>Valori riletti dal server di collaudo</h2><pre>{JSON.stringify(data, null, 2)}</pre>
      <EditRecordDialog open={open} onOpenChange={setOpen} title="Modifica cliente test" fields={fields} endpoint={fail ? '/qa-api/fail' : '/qa-api/save'} onSaved={reload} />
      <NewClienteDialog open={newOpen} onOpenChange={setNewOpen} onCreate={async (cliente) => {
        const response = await fetch(fail ? '/qa-api/fail' : '/qa-api/create', { method: 'POST', body: JSON.stringify(cliente) })
        if (!response.ok) throw new Error((await response.json()).error)
        await reload()
      }} />
    </main><Toaster />
  </ClienteTagProvider>
}
createRoot(document.getElementById('root')).render(<Harness />)
