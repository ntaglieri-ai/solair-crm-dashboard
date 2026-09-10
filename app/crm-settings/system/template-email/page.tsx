"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/lib/permissions/provider"
import { BULK_PLACEHOLDERS } from "@/lib/email/bulk-template"

/**
 * Libreria dei modelli e-mail.
 *
 * I modelli sono condivisi: uno utile serve a tutti, e tenerli personali
 * ripeterebbe il limite che Zoho ha sui filtri salvati.
 *
 * I segnaposto sono gli stessi dell'invio di massa, cosi' un modello si
 * comporta allo stesso modo nell'invio singolo e in quello massivo invece di
 * avere due sintassi da ricordare.
 */

const MODULI = [
  { valore: "clienti", etichetta: "Clienti" },
  { valore: "lead", etichetta: "Lead" },
  { valore: "installatori", etichetta: "Installatori" },
] as const

type Template = {
  id: string
  nome: string
  modulo: string
  oggetto: string
  corpo: string
  cartella: string | null
  attivo: boolean
}

const VUOTO = {
  id: "",
  nome: "",
  modulo: "clienti",
  oggetto: "",
  corpo: "",
  cartella: null,
  attivo: true,
} satisfies Template

export default function TemplateEmailPage() {
  const { canAction } = usePermissions()
  const puoGestire = canAction("email_template.gestione")

  const [template, setTemplate] = useState<Template[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [modulo, setModulo] = useState<string>("clienti")
  const [inModifica, setInModifica] = useState<Template | null>(null)

  const carica = useCallback(async () => {
    setCaricamento(true)
    try {
      const risposta = await fetch(`/api/crm-settings/email-template?modulo=${modulo}`, {
        cache: "no-store",
      })
      const dati = (await risposta.json()) as { template?: Template[] }
      setTemplate(dati.template ?? [])
    } catch {
      setTemplate([])
    } finally {
      setCaricamento(false)
    }
  }, [modulo])

  useEffect(() => {
    void carica()
  }, [carica])

  async function salva(bozza: Template) {
    const nuovo = !bozza.id
    const risposta = await fetch("/api/crm-settings/email-template", {
      method: nuovo ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bozza),
    })
    if (!risposta.ok) {
      const dati = (await risposta.json().catch(() => ({}))) as { error?: string }
      toast.error(dati.error ?? "Salvataggio non riuscito")
      return false
    }
    toast.success(nuovo ? "Modello creato" : "Modello aggiornato")
    await carica()
    return true
  }

  async function elimina(modello: Template) {
    if (!window.confirm(`Eliminare il modello "${modello.nome}"? Sparisce per tutti.`)) return
    const risposta = await fetch(`/api/crm-settings/email-template?id=${modello.id}`, {
      method: "DELETE",
    })
    if (!risposta.ok) {
      toast.error("Eliminazione non riuscita")
      return
    }
    await carica()
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Modelli e-mail"
        description="Testi pronti da riusare negli invii. Sono condivisi: chi ne scrive uno utile lo lascia a tutti."
        action={
          <div className="flex items-center gap-2">
            <Select value={modulo} onValueChange={(v) => setModulo(v ?? "clienti")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULI.map((m) => (
                  <SelectItem key={m.valore} value={m.valore}>
                    {m.etichetta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {puoGestire ? (
              <Button size="sm" onClick={() => setInModifica({ ...VUOTO, modulo })}>
                <Plus data-icon="inline-start" />
                Modello
              </Button>
            ) : null}
          </div>
        }
      />

      {caricamento ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Caricamento dei modelli…
        </div>
      ) : template.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nessun modello per questo modulo.
          {puoGestire ? " Creane uno per iniziare." : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {template.map((modello) => (
            <div
              key={modello.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
                !modello.attivo && "opacity-60",
              )}
            >
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{modello.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{modello.oggetto}</p>
              </div>

              {modello.cartella ? (
                <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {modello.cartella}
                </span>
              ) : null}

              {puoGestire ? (
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={modello.attivo ? "Disattiva" : "Attiva"}
                    title={
                      modello.attivo
                        ? "Disattiva: resta qui ma non compare fra i modelli proponibili"
                        : "Attiva"
                    }
                    onClick={() => void salva({ ...modello, attivo: !modello.attivo })}
                  >
                    {modello.attivo ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Modifica"
                    onClick={() => setInModifica(modello)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    aria-label="Elimina"
                    onClick={() => void elimina(modello)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {inModifica ? (
        <DialogoModello
          modello={inModifica}
          onChiudi={() => setInModifica(null)}
          onSalva={async (bozza) => {
            if (await salva(bozza)) setInModifica(null)
          }}
        />
      ) : null}
    </div>
  )
}

function DialogoModello({
  modello,
  onChiudi,
  onSalva,
}: {
  modello: Template
  onChiudi: () => void
  onSalva: (modello: Template) => Promise<void>
}) {
  const [bozza, setBozza] = useState(modello)
  const [inCorso, setInCorso] = useState(false)

  return (
    <Dialog open onOpenChange={(aperto) => (!aperto ? onChiudi() : undefined)}>
      <DialogContent className="flex max-h-[88vh] w-[min(820px,94vw)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{bozza.id ? "Modifica modello" : "Nuovo modello"}</DialogTitle>
          <DialogDescription>
            Nel testo puoi usare {BULK_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")}: vengono
            sostituiti con i dati del destinatario al momento dell&apos;invio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modello-nome">Nome</Label>
              <Input
                id="modello-nome"
                value={bozza.nome}
                onChange={(e) => setBozza({ ...bozza, nome: e.target.value })}
                placeholder="es. Sopralluogo confermativo"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modello-cartella">Cartella (facoltativa)</Label>
              <Input
                id="modello-cartella"
                value={bozza.cartella ?? ""}
                onChange={(e) => setBozza({ ...bozza, cartella: e.target.value })}
                placeholder="es. Sopralluoghi"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modello-oggetto">Oggetto</Label>
            <Input
              id="modello-oggetto"
              value={bozza.oggetto}
              onChange={(e) => setBozza({ ...bozza, oggetto: e.target.value })}
              placeholder="es. Sopralluogo confermato — {nome}"
            />
          </div>

          <div className="flex min-h-0 flex-col gap-1.5">
            <Label htmlFor="modello-corpo">Testo</Label>
            <Textarea
              id="modello-corpo"
              value={bozza.corpo}
              onChange={(e) => setBozza({ ...bozza, corpo: e.target.value })}
              rows={14}
              className="font-mono text-xs"
              placeholder={"Gentile {nome},\n\nle confermiamo il sopralluogo…"}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button
            disabled={inCorso || !bozza.nome.trim() || !bozza.oggetto.trim()}
            onClick={async () => {
              setInCorso(true)
              try {
                await onSalva(bozza)
              } finally {
                setInCorso(false)
              }
            }}
          >
            {inCorso ? <Loader2 className="size-4 animate-spin" /> : null}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
