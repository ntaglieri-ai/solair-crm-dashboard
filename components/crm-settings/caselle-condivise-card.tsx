"use client"

// Impostazioni CRM -> Comunicazioni: gestione delle caselle mittente CONDIVISE
// (crm_email_accounts con condivisa = true), quelle che compaiono nel dropdown
// "Invia da" di chiunque abbia ruoli.puo_scegliere_mittente.
//
// La card e' visibile solo a chi ha ruoli.puo_gestire_email_accounts. Il flag
// non e' nello snapshot dei permessi (vive su `ruoli`, non nelle tabelle
// permessi_*), quindi la visibilita' non si decide qui: si chiede all'API, che
// risponde 403 a chi non puo' gestirle, e in quel caso non si rende nulla.
//
// Le caselle personali degli utenti (condivisa = false) non compaiono mai:
// l'endpoint le esclude a monte.

import { useEffect, useState } from "react"
import { Loader2, Mail, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type SharedAccount = {
  id: string
  utente_id: string | null
  nome_visualizzato: string
  email: string
  condivisa: boolean
  attivo: boolean
  is_default: boolean
}

const ENDPOINT = "/api/crm-settings/email-accounts"

export function CaselleCondiviseCard() {
  const [visible, setVisible] = useState<boolean | null>(null)
  const [accounts, setAccounts] = useState<SharedAccount[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNome, setEditingNome] = useState("")
  const [nuovoNome, setNuovoNome] = useState("")
  const [nuovaEmail, setNuovaEmail] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(ENDPOINT, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return
        const data = (await res.json().catch(() => null)) as
          | { accounts?: SharedAccount[]; error?: string }
          | null
        // 401/403 = ruolo senza puo_gestire_email_accounts: la card sparisce
        // invece di mostrare un errore, perche' per quell'utente la sezione
        // semplicemente non esiste.
        if (!res.ok) {
          setVisible(false)
          return
        }
        setAccounts(data?.accounts ?? [])
        setVisible(true)
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function creaCasella() {
    setCreating(true)
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeVisualizzato: nuovoNome, email: nuovaEmail }),
      })
      const data = (await res.json().catch(() => null)) as
        | { account?: SharedAccount; error?: string }
        | null
      if (!res.ok || !data?.account) {
        toast.error(data?.error ?? "Impossibile creare la casella.")
        return
      }
      const created = data.account
      setAccounts((current) =>
        [...current, created].sort((a, b) =>
          a.nome_visualizzato.localeCompare(b.nome_visualizzato),
        ),
      )
      setNuovoNome("")
      setNuovaEmail("")
      toast.success("Casella condivisa creata")
    } catch {
      toast.error("Impossibile creare la casella: errore di rete.")
    } finally {
      setCreating(false)
    }
  }

  async function aggiorna(id: string, patch: { nomeVisualizzato?: string; attivo?: boolean }) {
    setBusyId(id)
    try {
      const res = await fetch(`${ENDPOINT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => null)) as
        | { account?: SharedAccount; error?: string }
        | null
      if (!res.ok || !data?.account) {
        toast.error(data?.error ?? "Modifica non riuscita.")
        return
      }
      const updated = data.account
      setAccounts((current) => current.map((a) => (a.id === id ? updated : a)))
      setEditingId(null)
      toast.success(
        patch.attivo === undefined
          ? "Nome aggiornato"
          : patch.attivo
            ? "Casella riattivata"
            : "Casella disattivata",
      )
    } catch {
      toast.error("Modifica non riuscita: errore di rete.")
    } finally {
      setBusyId(null)
    }
  }

  async function elimina(account: SharedAccount) {
    if (!window.confirm(`Eliminare definitivamente ${account.email}?`)) return
    setBusyId(account.id)
    try {
      const res = await fetch(`${ENDPOINT}/${account.id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(data?.error ?? "Eliminazione non riuscita.")
        return
      }
      setAccounts((current) => current.filter((a) => a.id !== account.id))
      toast.success("Casella eliminata")
    } catch {
      toast.error("Eliminazione non riuscita: errore di rete.")
    } finally {
      setBusyId(null)
    }
  }

  if (visible !== true) return null

  const emailValida = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuovaEmail.trim())

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="size-5 text-navy" />
        <h3 className="text-base font-black text-foreground">Caselle mittente condivise</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Compaiono nel menu &quot;Invia da&quot; di chi puo&apos; scegliere il mittente, sul compose
        singolo e sugli invii di massa. Le caselle personali degli utenti non si gestiscono da qui.
      </p>

      <div className="flex flex-col gap-2">
        {accounts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Nessuna casella condivisa configurata.
          </p>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5",
                !account.attivo && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                {editingId === account.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingNome}
                      onChange={(event) => setEditingNome(event.target.value)}
                      className="h-8 max-w-xs"
                      aria-label="Nome visualizzato"
                    />
                    <Button
                      size="sm"
                      disabled={!editingNome.trim() || busyId === account.id}
                      onClick={() => aggiorna(account.id, { nomeVisualizzato: editingNome })}
                    >
                      Salva
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground">{account.nome_visualizzato}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {account.email}
                    </span>
                    {account.utente_id ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                        anche personale
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">
                  {account.attivo ? "Attiva" : "Disattivata"}
                </span>
                <Switch
                  checked={account.attivo}
                  disabled={busyId === account.id}
                  onCheckedChange={(attivo) => aggiorna(account.id, { attivo })}
                  aria-label={`Attiva ${account.email}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busyId === account.id}
                  title="Modifica nome visualizzato"
                  onClick={() => {
                    setEditingId(account.id)
                    setEditingNome(account.nome_visualizzato)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive hover:text-destructive"
                  disabled={busyId === account.id || Boolean(account.utente_id)}
                  title={
                    account.utente_id
                      ? "E' il mittente di default di un utente: disattivala invece di eliminarla"
                      : "Elimina casella"
                  }
                  onClick={() => elimina(account)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nuova-casella-nome">Nome visualizzato</Label>
          <Input
            id="nuova-casella-nome"
            value={nuovoNome}
            onChange={(event) => setNuovoNome(event.target.value)}
            placeholder="Es. Amministrazione"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nuova-casella-email">Indirizzo</Label>
          <Input
            id="nuova-casella-email"
            value={nuovaEmail}
            onChange={(event) => setNuovaEmail(event.target.value)}
            placeholder="amministrazione@solairgroup.it"
          />
        </div>
        <Button
          disabled={!nuovoNome.trim() || !emailValida || creating}
          onClick={creaCasella}
          className="bg-navy text-navy-foreground hover:bg-navy/90"
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          ) : (
            <Plus className="size-4" data-icon="inline-start" />
          )}
          Aggiungi
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        L&apos;invio usa le credenziali SES gia&apos; configurate: qualsiasi indirizzo
        @solairgroup.it puo&apos; fare da mittente senza credenziali proprie. Un indirizzo fuori da
        questo dominio viene rifiutato da SES finche&apos; non e&apos; verificato singolarmente.
      </p>
    </section>
  )
}
