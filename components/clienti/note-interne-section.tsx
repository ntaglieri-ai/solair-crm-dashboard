"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { IconLock, IconPencil, IconTrash, IconX, IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { usePermissions } from "@/lib/permissions/provider"
import { type NotaInterna } from "@/lib/clienti/note-interne"
import { ClienteAvatar } from "./cliente-utils"

const QUANDO = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
})

function formatQuando(iso: string | null) {
  if (!iso) return ""
  return QUANDO.format(new Date(iso))
}

function NotaCard({
  nota,
  onSave,
  onDelete,
}: {
  nota: NotaInterna
  onSave: (id: string, contenuto: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(nota.contenuto)
  const [busy, setBusy] = useState(false)
  const autore = nota.creato_da_nome ?? "Utente rimosso"

  const salva = async () => {
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      await onSave(nota.id, draft.trim())
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="group flex gap-3">
      <ClienteAvatar nome={autore} className="size-8 text-[11px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-warning/30 bg-warning/[0.04] p-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">{autore}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatQuando(nota.creato_il)}
          </span>
          {nota.modificato_il ? (
            <span className="text-[11px] italic text-muted-foreground">
              · modificata da {nota.modificato_da_nome ?? "utente rimosso"} il{" "}
              {formatQuando(nota.modificato_il)}
            </span>
          ) : null}
          {!editing ? (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Modifica nota interna"
                onClick={() => {
                  setDraft(nota.contenuto)
                  setEditing(true)
                }}
              >
                <IconPencil size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                aria-label="Elimina nota interna"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onDelete(nota.id)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <IconTrash size={14} />
              </Button>
            </div>
          ) : null}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="bg-card text-[13px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(nota.contenuto)
                  setEditing(false)
                }}
              >
                <IconX size={14} data-icon="inline-start" />
                Annulla
              </Button>
              <Button size="sm" disabled={!draft.trim() || busy} onClick={salva}>
                <IconCheck size={14} data-icon="inline-start" />
                Salva
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] text-foreground">{nota.contenuto}</p>
        )}
      </div>
    </li>
  )
}

/**
 * Sezione "Note interne" della scheda cliente — distinta dalle "Note
 * cliente" (che vivono in `attivita`) sia come tabella sia come
 * visibilita'.
 *
 * Il componente non si monta nemmeno per i ruoli non abilitati: e' una
 * cortesia, non una difesa. Il muro e' la RLS su cliente_note_interne,
 * e le route rispondono 404.
 */
export function NoteInterneSection({ clienteId }: { clienteId: string }) {
  const permissions = usePermissions()
  const abilitato = permissions.canAction("clienti.note_interne.view")

  const [note, setNote] = useState<NotaInterna[]>([])
  const [loading, setLoading] = useState(true)
  const [nuova, setNuova] = useState("")
  const [saving, setSaving] = useState(false)

  const carica = useCallback(async () => {
    try {
      const res = await fetch(`/api/clienti/${clienteId}/note-interne`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error()
      const payload = (await res.json()) as { note: NotaInterna[] }
      setNote(payload.note ?? [])
    } catch {
      toast.error("Impossibile caricare le note interne")
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    if (!abilitato) return
    void carica()
  }, [abilitato, carica])

  if (!abilitato) return null

  const aggiungi = async () => {
    const contenuto = nuova.trim()
    if (!contenuto || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clienti/${clienteId}/note-interne`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenuto }),
      })
      if (!res.ok) throw new Error()
      const creata = (await res.json()) as NotaInterna
      setNote((prev) => [creata, ...prev])
      setNuova("")
      toast.success("Nota interna aggiunta")
    } catch {
      toast.error("Errore nel salvataggio della nota interna")
    } finally {
      setSaving(false)
    }
  }

  const salva = async (id: string, contenuto: string) => {
    const res = await fetch(`/api/clienti/${clienteId}/note-interne/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenuto }),
    })
    if (!res.ok) {
      toast.error("Errore nell'aggiornamento della nota interna")
      return
    }
    // Il nome di chi modifica non torna dalla PATCH: si prende dal
    // soggetto della sessione, che e' esattamente chi ha appena scritto.
    const subject = permissions.snapshot.subject
    setNote((prev) =>
      prev.map((nota) =>
        nota.id === id
          ? {
              ...nota,
              contenuto,
              modificato_da: subject.userId,
              modificato_da_nome: subject.nome,
              modificato_il: new Date().toISOString(),
            }
          : nota,
      ),
    )
    toast.success("Nota interna aggiornata")
  }

  const elimina = async (id: string) => {
    const res = await fetch(`/api/clienti/${clienteId}/note-interne/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("Errore nell'eliminazione della nota interna")
      return
    }
    setNote((prev) => prev.filter((nota) => nota.id !== id))
    toast.success("Nota interna eliminata")
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-warning">
        <IconLock size={14} className="shrink-0" />
        Visibili solo a Superadmin, Amministratori e Direttori. Non compaiono nelle
        note cliente.
      </p>

      {loading ? (
        <p className="text-[13px] text-muted-foreground">Caricamento…</p>
      ) : note.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {note.map((nota) => (
            <NotaCard key={nota.id} nota={nota} onSave={salva} onDelete={elimina} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Nessuna nota interna su questo cliente.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <Textarea
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          rows={2}
          placeholder="Aggiungi nota interna…"
          className="bg-card text-[13px]"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={nuova.trim() === "" || saving}
            className="bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={aggiungi}
          >
            Salva nota interna
          </Button>
        </div>
      </div>
    </div>
  )
}
