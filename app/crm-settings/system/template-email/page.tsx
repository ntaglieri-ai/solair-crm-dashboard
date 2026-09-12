"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Eye, Loader2, Mail, Pencil, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { EmailTemplateEditor } from "@/components/shared/email-template-editor"
import { usePermissions } from "@/lib/permissions/provider"
import { BULK_PLACEHOLDERS } from "@/lib/email/bulk-template"
import { modelloBase } from "@/lib/email/modello-base"

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

type ModuloTemplate = (typeof MODULI)[number]["valore"]

type Template = {
  id: string
  nome: string
  modulo: ModuloTemplate
  oggetto: string
  corpo: string
  cartella: string | null
  attivo: boolean
  zoho_id: string | null
}

const VUOTO = {
  id: "",
  nome: "",
  modulo: "clienti",
  oggetto: "",
  corpo: "",
  cartella: null,
  attivo: true,
  zoho_id: null,
} satisfies Template

const SUFFISSO_NUOVO = " (nuovo)"
const VARIABILI_EDITOR = BULK_PLACEHOLDERS.map((p) => `{${p}}`)

function isModuloTemplate(valore: unknown): valore is ModuloTemplate {
  return typeof valore === "string" && MODULI.some((modulo) => modulo.valore === valore)
}

function nomeVisibile(nome: string): string {
  return nome.endsWith(SUFFISSO_NUOVO) ? nome.slice(0, -SUFFISSO_NUOVO.length) : nome
}

function chiaveOriginale(modello: Pick<Template, "modulo" | "nome">): string {
  return `${modello.modulo}:${nomeVisibile(modello.nome)}`
}

export default function TemplateEmailPage() {
  const { canAction } = usePermissions()
  const puoGestire = canAction("email_template.gestione")

  const [template, setTemplate] = useState<Template[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [modulo, setModulo] = useState<ModuloTemplate>("clienti")
  const [inModifica, setInModifica] = useState<Template | null>(null)
  const [inAnteprima, setInAnteprima] = useState<Template | null>(null)
  const [conversione, setConversione] = useState(false)
  const [switchMassivo, setSwitchMassivo] = useState<"nuovi" | "vecchi" | null>(null)

  // Gia' convertiti si riconoscono dal suffisso: rilanciare non deve
  // produrre "(nuovo) (nuovo)".
  const daConvertire = template.filter((modello) => !modello.nome.endsWith(SUFFISSO_NUOVO))
  const convertiti = new Set(
    template
      .filter((modello) => modello.nome.endsWith(SUFFISSO_NUOVO))
      .map((modello) => chiaveOriginale(modello)),
  )
  const templateVisibili = template.filter(
    (modello) => !(modello.zoho_id && convertiti.has(chiaveOriginale(modello))),
  )
  const attiviVisibili = templateVisibili.filter((modello) => modello.attivo).length

  async function converti() {
    const conferma = window.confirm(
      `Creare la versione nel formato Solair di ${daConvertire.length} modelli?\n\n` +
        "Gli originali non vengono toccati: nascono modelli affiancati, spenti, " +
        "da guardare e accendere uno per uno.\n\n" +
        "Del modello originale si tiene il testo, non l'impaginazione. Logo e dati aziendali " +
        "arrivano da Informazioni aziendali.",
    )
    if (!conferma) return

    setConversione(true)
    try {
      const risposta = await fetch("/api/crm-settings/email-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: "converti", ids: daConvertire.map((m) => m.id) }),
      })
      const dati = (await risposta.json()) as { creati?: number; saltati?: number; error?: string }
      if (!risposta.ok) {
        toast.error(dati.error ?? "Conversione non riuscita")
        return
      }
      toast.success(
        `${dati.creati} modelli creati${dati.saltati ? `, ${dati.saltati} saltati` : ""}. Sono spenti: accendili dopo averli guardati.`,
      )
      await carica()
    } finally {
      setConversione(false)
    }
  }

  async function commutaMassivo(modo: "nuovi" | "vecchi") {
    const usaNuovi = modo === "nuovi"
    const conferma = window.confirm(
      usaNuovi
        ? "Attivare tutti i modelli nuovi e nascondere i vecchi importati da Zoho?\n\nVale per Clienti, Lead e Installatori. I modelli creati a mano nel CRM non vengono toccati."
        : "Ripristinare gli old models e spegnere i rispettivi modelli nuovi?\n\nVale per Clienti, Lead e Installatori. I modelli creati a mano nel CRM non vengono toccati.",
    )
    if (!conferma) return

    setSwitchMassivo(modo)
    try {
      const risposta = await fetch("/api/crm-settings/email-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          azione: usaNuovi ? "usa-convertiti" : "ripristina-originali",
        }),
      })
      const dati = (await risposta.json().catch(() => ({}))) as {
        attivati?: number
        nascosti?: number
        mancanti?: number
        error?: string
      }
      if (!risposta.ok) {
        toast.error(dati.error ?? "Aggiornamento non riuscito")
        return
      }
      toast.success(
        usaNuovi
          ? `${dati.attivati ?? 0} modelli nuovi attivati, ${dati.nascosti ?? 0} vecchi nascosti.`
          : `${dati.attivati ?? 0} vecchi modelli ripristinati, ${dati.nascosti ?? 0} nuovi spenti.`,
      )
      if (dati.mancanti) {
        toast.warning(`${dati.mancanti} originali non hanno ancora una versione nuova.`)
      }
      await carica()
    } finally {
      setSwitchMassivo(null)
    }
  }

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
    const dati = (await risposta.json().catch(() => ({}))) as Partial<Template> & { error?: string }
    if (!risposta.ok) {
      toast.error(dati.error ?? "Salvataggio non riuscito")
      return false
    }
    toast.success(nuovo ? "Modello creato" : "Modello aggiornato")
    if (isModuloTemplate(dati.modulo) && dati.modulo !== modulo) {
      setModulo(dati.modulo)
    } else {
      await carica()
    }
    return true
  }

  async function elimina(modello: Template) {
    if (!window.confirm(`Eliminare il modello "${nomeVisibile(modello.nome)}"? Sparisce per tutti.`)) return
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
        description={
          caricamento
            ? "Testi pronti da riusare negli invii. Sono condivisi: chi ne scrive uno utile lo lascia a tutti."
            : `${attiviVisibili} attivi su ${templateVisibili.length}. Solo quelli attivi compaiono quando si scrive un'email; gli altri restano qui col loro testo.`
        }
        action={
          <div className="flex items-center gap-2">
            <Select
              value={modulo}
              onValueChange={(valore) => setModulo(isModuloTemplate(valore) ? valore : "clienti")}
            >
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
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  disabled={conversione || switchMassivo !== null || daConvertire.length === 0}
                  title="Crea una versione con logo e dati aziendali, senza toccare gli originali"
                  onClick={() => void converti()}
                >
                  {conversione ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 data-icon="inline-start" />
                  )}
                  Applica formato aziendale
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  disabled={conversione || switchMassivo !== null}
                  title="Accende tutti i modelli nuovi e spegne i vecchi importati da Zoho"
                  onClick={() => void commutaMassivo("nuovi")}
                >
                  {switchMassivo === "nuovi" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 data-icon="inline-start" />
                  )}
                  Usa nuovi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  disabled={conversione || switchMassivo !== null}
                  title="Riaccende gli old models e spegne i rispettivi modelli nuovi"
                  onClick={() => void commutaMassivo("vecchi")}
                >
                  {switchMassivo === "vecchi" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw data-icon="inline-start" />
                  )}
                  Old models
                </Button>
                <Button size="sm" onClick={() => setInModifica({ ...VUOTO, modulo })}>
                  <Plus data-icon="inline-start" />
                  Modello
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {caricamento ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Caricamento dei modelli…
        </div>
      ) : templateVisibili.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nessun modello per questo modulo.
          {puoGestire ? " Creane uno per iniziare." : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templateVisibili.map((modello) => (
            <div
              key={modello.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {nomeVisibile(modello.nome)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{modello.oggetto}</p>
              </div>

              {modello.cartella ? (
                <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {modello.cartella}
                </span>
              ) : null}

              {/* Un modello o e' attivo o non lo e': un interruttore lo dice
                  meglio di un'icona da interpretare. Attivo = proponibile
                  quando si scrive un'email; spento = resta qui col suo testo
                  ma non compare fra le scelte. */}
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={modello.attivo}
                  disabled={!puoGestire}
                  aria-label={`${nomeVisibile(modello.nome)}: ${
                    modello.attivo ? "attivo" : "non attivo"
                  }`}
                  onCheckedChange={(valore) =>
                    void salva({ ...modello, attivo: Boolean(valore) })
                  }
                />
                <span className="w-14 shrink-0 text-xs text-muted-foreground">
                  {modello.attivo ? "Attivo" : "Spento"}
                </span>
              </div>

              {puoGestire ? (
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Anteprima"
                    title="Anteprima"
                    onClick={() => setInAnteprima(modello)}
                  >
                    <Eye className="size-4" />
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

      {inAnteprima ? (
        <DialogoAnteprima modello={inAnteprima} onChiudi={() => setInAnteprima(null)} />
      ) : null}
    </div>
  )
}

function htmlSicuro(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

function escapeHtmlPreview(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function corpoAnteprima(corpo: string): string {
  const content = corpo.trim()
  if (!content) {
    return '<p class="empty">Modello senza corpo.</p>'
  }
  if (/<\s*(html|body|table|div|p|br|span|ul|ol|li|strong|b)\b/i.test(content)) {
    const match = htmlSicuro(content).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
    return match?.[1] ?? htmlSicuro(content)
  }

  return content
    .replace(/\r\n|\r/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtmlPreview(block).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

function documentoAnteprima(modello: Template): string {
  const corpo = modello.corpo.trim()
  if (/<\s*(html|body)\b/i.test(corpo)) {
    return htmlSicuro(corpo)
  }

  return modelloBase(corpo ? corpoAnteprima(corpo) : '<p style="color:#64748b">Modello senza corpo.</p>')
}

function segnapostoNelModello(modello: Template): string[] {
  const testo = `${modello.oggetto}\n${modello.corpo}`
  const trovati = new Set<string>()
  for (const match of testo.matchAll(/\$\{[^}]+\}|\{[^{}]+\}/g)) {
    trovati.add(match[0])
  }
  return Array.from(trovati)
}

function testoDaHtml(value: string): string {
  return value
    .replace(/<head\b[\s\S]*?<\/head>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function DialogoAnteprima({
  modello,
  onChiudi,
}: {
  modello: Template
  onChiudi: () => void
}) {
  const segnaposto = segnapostoNelModello(modello)
  const testo = testoDaHtml(modello.corpo)

  return (
    <Dialog open onOpenChange={(aperto) => (!aperto ? onChiudi() : undefined)}>
      <DialogContent className="flex h-[90vh] w-[min(1120px,96vw)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
        <Tabs defaultValue="anteprima" className="min-h-0 flex-1 gap-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>Anteprima modello</DialogTitle>
                <DialogDescription className="space-y-1">
                  <span className="block font-medium text-foreground">
                    {nomeVisibile(modello.nome)}
                  </span>
                  <span className="block truncate">{modello.oggetto}</span>
                </DialogDescription>
              </div>
              <TabsList className="h-9 rounded-full">
                <TabsTrigger value="anteprima" className="rounded-full px-5">
                  Anteprima
                </TabsTrigger>
                <TabsTrigger value="analisi" className="rounded-full px-5">
                  Analisi
                </TabsTrigger>
              </TabsList>
            </div>
          </DialogHeader>

          <TabsContent value="anteprima" className="min-h-0 bg-[#eeeeee] p-0">
            <iframe
              title={`Anteprima ${nomeVisibile(modello.nome)}`}
              srcDoc={documentoAnteprima(modello)}
              sandbox=""
              className="h-full w-full border-0 bg-[#eeeeee]"
            />
          </TabsContent>

          <TabsContent value="analisi" className="min-h-0 overflow-y-auto bg-muted/30 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Caratteri
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{testo.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Segnaposto
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{segnaposto.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Stato
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {modello.attivo ? "Attivo" : "Spento"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Segnaposto trovati</p>
              {segnaposto.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {segnaposto.map((token) => (
                    <span
                      key={token}
                      className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nessun segnaposto nel modello.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onChiudi}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              <Label htmlFor="modello-modulo">Modulo</Label>
              <Select
                value={bozza.modulo}
                onValueChange={(valore) =>
                  setBozza({ ...bozza, modulo: isModuloTemplate(valore) ? valore : bozza.modulo })
                }
              >
                <SelectTrigger id="modello-modulo">
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
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modello-cartella">Cartella (facoltativa)</Label>
              <Input
                id="modello-cartella"
                value={bozza.cartella ?? ""}
                onChange={(e) => setBozza({ ...bozza, cartella: e.target.value })}
                placeholder="es. Sopralluoghi"
              />
            </div>
            <div className="flex min-w-40 flex-col justify-end gap-2 rounded-md border border-border px-3 py-2">
              <Label htmlFor="modello-attivo" className="text-sm">
                Disponibile in invio
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="modello-attivo"
                  checked={bozza.attivo}
                  onCheckedChange={(valore) => setBozza({ ...bozza, attivo: Boolean(valore) })}
                />
                <span className="text-xs text-muted-foreground">
                  {bozza.attivo ? "Attivo" : "Spento"}
                </span>
              </div>
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
            <Label htmlFor="modello-corpo">Corpo e-mail</Label>
            <EmailTemplateEditor
              id="modello-corpo"
              value={bozza.corpo}
              onChange={(corpo) => setBozza((corrente) => ({ ...corrente, corpo }))}
              disabled={inCorso}
              variables={VARIABILI_EDITOR}
              placeholder="Gentile {nome}, scrivi qui il corpo del modello..."
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
