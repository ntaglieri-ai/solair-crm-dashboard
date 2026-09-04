"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { IconLock, IconPencil, IconTrash, IconX, IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { MentionTextarea, MentionText } from "@/components/shared/note-mentions"
import type { NoteMentionDraft, NoteMention } from "@/lib/notes/mentions"
import { usePermissions } from "@/lib/permissions/provider"
import { canAccessNoteInterne, type NotaInterna } from "@/lib/clienti/note-interne"
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
  usersUrl,
}: {
  nota: NotaInterna
  onSave: (id: string, contenuto: string, menzioni: NoteMentionDraft[]) => Promise<void>
  onDelete: (id: string) => Promise<void>
  usersUrl: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(nota.contenuto)
  const [menzioni, setMenzioni] = useState<NoteMentionDraft[]>(nota.menzioni ?? [])
  const [busy, setBusy] = useState(false)
  const autore = nota.creato_da_nome ?? "Utente rimosso"

  const salva = async () => {
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      await onSave(nota.id, draft, menzioni)
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nell'aggiornamento della nota interna")
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
                  setMenzioni(nota.menzioni ?? [])
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
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              mentions={menzioni}
              onMentionsChange={setMenzioni}
              usersUrl={usersUrl}
              disabled={busy}
              placeholder="Modifica nota interna… usa @ per menzionare"
              rows={3}
              className="bg-card text-[13px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
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
          <MentionText text={nota.contenuto} mentions={nota.menzioni} allowEmail={false} className="text-[13px] text-foreground" />
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
  const abilitato = canAccessNoteInterne(permissions.snapshot.subject.ruoloCode) && permissions.canAction("clienti.note_interne.view")

  const [note, setNote] = useState<NotaInterna[]>([])
  const [loading, setLoading] = useState(true)
  const [nuova, setNuova] = useState("")
  const [nuoveMenzioni, setNuoveMenzioni] = useState<NoteMentionDraft[]>([])
  const [saving, setSaving] = useState(false)
  const usersUrl = `/api/clienti/${clienteId}/note-interne/mention-users`

  useEffect(() => {
    if (!abilitato) return
    let current = true
    fetch(`/api/clienti/${clienteId}/note-interne`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const payload = await res.json() as { note: NotaInterna[] }
        if (current) setNote(payload.note ?? [])
      })
      .catch(() => { if (current) toast.error("Impossibile caricare le note interne") })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [abilitato, clienteId])

  if (!abilitato) return null

  const aggiungi = async () => {
    const contenuto = nuova
    if (!contenuto.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clienti/${clienteId}/note-interne`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenuto, menzioni: nuoveMenzioni }),
      })
      const creata = (await res.json()) as NotaInterna & { error?: string; notificationFailures?: number }
      if (!res.ok) throw new Error(creata.error ?? "Errore nel salvataggio della nota interna")
      setNote((prev) => [creata, ...prev])
      setNuova("")
      setNuoveMenzioni([])
      toast.success("Nota interna aggiunta")
      if (creata.notificationFailures) toast.warning("Nota salvata, ma alcune notifiche delle menzioni non sono state inviate")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nel salvataggio della nota interna")
    } finally {
      setSaving(false)
    }
  }

  const salva = async (id: string, contenuto: string, menzioni: NoteMentionDraft[]) => {
    const res = await fetch(`/api/clienti/${clienteId}/note-interne/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenuto, menzioni }),
    })
    const payload = await res.json() as { error?: string; menzioni: NoteMention[]; contenuto: string; modificato_il: string; notificationFailures?: number }
    if (!res.ok) throw new Error(payload.error ?? "Errore nell'aggiornamento della nota interna")
    // Il nome di chi modifica non torna dalla PATCH: si prende dal
    // soggetto della sessione, che e' esattamente chi ha appena scritto.
    const subject = permissions.snapshot.subject
    setNote((prev) =>
      prev.map((nota) =>
        nota.id === id
          ? {
              ...nota,
              contenuto: payload.contenuto,
              menzioni: payload.menzioni,
              modificato_da: subject.userId,
              modificato_da_nome: subject.nome,
              modificato_il: payload.modificato_il,
            }
          : nota,
      ),
    )
    toast.success("Nota interna aggiornata")
    if (payload.notificationFailures) toast.warning("Nota salvata, ma alcune notifiche delle menzioni non sono state inviate")
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
        note cliente. Con @ puoi menzionare chi ha accesso a questa scheda; l’email contiene solo un avviso, non il testo riservato.
      </p>

      {loading ? (
        <p className="text-[13px] text-muted-foreground">Caricamento…</p>
      ) : note.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {note.map((nota) => (
            <NotaCard key={nota.id} nota={nota} onSave={salva} onDelete={elimina} usersUrl={usersUrl} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Nessuna nota interna su questo cliente.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <MentionTextarea
          value={nuova}
          onChange={setNuova}
          mentions={nuoveMenzioni}
          onMentionsChange={setNuoveMenzioni}
          usersUrl={usersUrl}
          disabled={saving}
          rows={2}
          placeholder="Aggiungi nota interna… usa @ per menzionare"
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
