"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { CAMPO_TIPI, CAMPO_TIPO_LABEL } from "@/lib/system-settings-data"
import type { LayoutBlocco, LayoutCampo, LayoutPagina } from "@/lib/crm-settings/layout"
import { LAYOUT_MODULI, type LayoutModulo } from "@/lib/crm-settings/layout-validate"

const MODULO_LABEL: Record<LayoutModulo, string> = {
  clienti: "Clienti",
  lead: "Lead",
  installatori: "Installatori",
}

const PAGE_KEY = "crm_settings.system.layout"

/**
 * Chiave di rimontaggio del dialogo: cambia a ogni apertura diversa, cosi' il
 * form riparte vuoto senza azzerare gli stati dentro un effect.
 */
function chiaveDialogo(dialogo: Dialogo): string {
  if (!dialogo) return "chiuso"
  if (dialogo.tipo === "pagina") return "pagina"
  if (dialogo.tipo === "blocco") return `blocco:${dialogo.paginaId}`
  return `campo:${dialogo.bloccoId}`
}

type Dialogo =
  | { tipo: "pagina" }
  | { tipo: "blocco"; paginaId: string; paginaLabel: string }
  | { tipo: "campo"; bloccoId: string; bloccoLabel: string }
  | null

export default function LayoutSchedePage() {
  const { pageAccess } = usePermissions()
  const readonly = pageAccess(PAGE_KEY) !== "rw"

  const [modulo, setModulo] = useState<LayoutModulo>("clienti")
  const [pagine, setPagine] = useState<LayoutPagina[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [aperte, setAperte] = useState<Set<string>>(new Set())
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const carica = useCallback(async () => {
    setCaricamento(true)
    setErrore(null)
    try {
      const risposta = await fetch(`/api/crm-settings/layout?modulo=${modulo}`)
      const dati = await risposta.json()
      if (!risposta.ok) throw new Error(dati.error ?? "Caricamento non riuscito")
      setPagine(dati.pagine ?? [])
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Caricamento non riuscito")
      setPagine([])
    } finally {
      setCaricamento(false)
    }
  }, [modulo])

  useEffect(() => {
    // Differito come nella pagina Valori: carica() alza subito il flag di
    // caricamento, e farlo in modo sincrono dentro l'effect innescherebbe un
    // render a cascata.
    queueMicrotask(() => void carica())
  }, [carica])

  /** Ogni scrittura ricarica: il server e' la fonte di verita' dell'ordine. */
  const scrivi = useCallback(
    async (init: RequestInit & { url?: string }) => {
      setErrore(null)
      try {
        const risposta = await fetch(init.url ?? "/api/crm-settings/layout", init)
        const dati = await risposta.json().catch(() => ({}))
        if (!risposta.ok) throw new Error(dati.error ?? "Operazione non riuscita")
        await carica()
        return true
      } catch (e) {
        setErrore(e instanceof Error ? e.message : "Operazione non riuscita")
        return false
      }
    },
    [carica],
  )

  function alterna(id: string) {
    setAperte((precedenti) => {
      const nuove = new Set(precedenti)
      if (nuove.has(id)) nuove.delete(id)
      else nuove.add(id)
      return nuove
    })
  }

  async function cambiaVisibilita(tipo: string, id: string, visible: boolean) {
    await scrivi({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo, tipo, id, visible }),
    })
  }

  async function elimina(tipo: string, id: string, avviso: string) {
    if (!window.confirm(avviso)) return
    await scrivi({
      method: "DELETE",
      url: `/api/crm-settings/layout?tipo=${tipo}&id=${id}`,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Layout schede"
        description="Pagine, blocchi e disposizione dei campi nelle schede record. La struttura definita qui vale per tutti; ogni utente puo' poi riordinare le pagine per se'."
        action={
          <div className="flex items-center gap-2">
            <Select value={modulo} onValueChange={(v) => setModulo(v as LayoutModulo)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_MODULI.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODULO_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!readonly ? (
              <Button size="sm" onClick={() => setDialogo({ tipo: "pagina" })}>
                <Plus data-icon="inline-start" />
                Pagina
              </Button>
            ) : null}
          </div>
        }
      />

      {errore ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errore}
        </div>
      ) : null}

      {caricamento ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Caricamento del layout…
        </div>
      ) : pagine.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nessuna pagina configurata per {MODULO_LABEL[modulo]}.
          {!readonly ? " Aggiungine una per iniziare." : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pagine.map((pagina) => (
            <RigaPagina
              key={pagina.id}
              pagina={pagina}
              aperta={aperte.has(pagina.id)}
              readonly={readonly}
              onAlterna={() => alterna(pagina.id)}
              onVisibilita={(v) => cambiaVisibilita("pagina", pagina.id, v)}
              onElimina={() =>
                elimina(
                  "pagina",
                  pagina.id,
                  `Eliminare la pagina "${pagina.label}"? Spariranno anche i suoi blocchi e la disposizione dei campi al loro interno. I dati dei campi non vengono toccati.`,
                )
              }
              onNuovoBlocco={() =>
                setDialogo({ tipo: "blocco", paginaId: pagina.id, paginaLabel: pagina.label })
              }
              onBloccoVisibilita={(id, v) => cambiaVisibilita("blocco", id, v)}
              onBloccoElimina={(id, label) =>
                elimina(
                  "blocco",
                  id,
                  `Eliminare il blocco "${label}"? I campi al suo interno tornano disponibili da riposizionare. I dati non vengono toccati.`,
                )
              }
              onNuovoCampo={(bloccoId, bloccoLabel) =>
                setDialogo({ tipo: "campo", bloccoId, bloccoLabel })
              }
              onCampoVisibilita={(id, v) => cambiaVisibilita("campo", id, v)}
              onCampoElimina={(id, label) =>
                elimina(
                  "campo",
                  id,
                  `Togliere "${label}" dal layout? Il campo e il suo contenuto restano nel database, sparisce solo dalla scheda.`,
                )
              }
            />
          ))}
        </div>
      )}

      <DialogoCreazione
        key={chiaveDialogo(dialogo)}
        dialogo={dialogo}
        modulo={modulo}
        onChiudi={() => setDialogo(null)}
        onCrea={async (corpo) => {
          const ok = await scrivi({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modulo, ...corpo }),
          })
          if (ok) setDialogo(null)
        }}
      />
    </div>
  )
}

function RigaPagina({
  pagina,
  aperta,
  readonly,
  onAlterna,
  onVisibilita,
  onElimina,
  onNuovoBlocco,
  onBloccoVisibilita,
  onBloccoElimina,
  onNuovoCampo,
  onCampoVisibilita,
  onCampoElimina,
}: {
  pagina: LayoutPagina
  aperta: boolean
  readonly: boolean
  onAlterna: () => void
  onVisibilita: (visible: boolean) => void
  onElimina: () => void
  onNuovoBlocco: () => void
  onBloccoVisibilita: (id: string, visible: boolean) => void
  onBloccoElimina: (id: string, label: string) => void
  onNuovoCampo: (bloccoId: string, bloccoLabel: string) => void
  onCampoVisibilita: (id: string, visible: boolean) => void
  onCampoElimina: (id: string, label: string) => void
}) {
  const conteggio = pagina.blocchi.reduce((somma, b) => somma + b.campi.length, 0)

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card",
        !pagina.visible && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onAlterna}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {aperta ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-semibold text-foreground">{pagina.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {pagina.componente
              ? "componente dedicato"
              : `${pagina.blocchi.length} blocchi · ${conteggio} campi`}
          </span>
        </button>

        {!readonly ? (
          <div className="flex items-center gap-1">
            {!pagina.componente ? (
              <Button size="sm" variant="ghost" onClick={onNuovoBlocco}>
                <Plus data-icon="inline-start" />
                Blocco
              </Button>
            ) : null}
            <BottoneVisibilita visible={pagina.visible} onCambia={onVisibilita} />
            <Button size="icon" variant="ghost" aria-label="Elimina pagina" onClick={onElimina}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {aperta ? (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
          {pagina.componente ? (
            <p className="text-xs text-muted-foreground">
              Questa pagina mostra un componente dedicato ({pagina.componente}) e non contiene
              campi configurabili.
            </p>
          ) : pagina.blocchi.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun blocco in questa pagina.</p>
          ) : (
            pagina.blocchi.map((blocco) => (
              <RigaBlocco
                key={blocco.id}
                blocco={blocco}
                readonly={readonly}
                onVisibilita={(v) => onBloccoVisibilita(blocco.id, v)}
                onElimina={() => onBloccoElimina(blocco.id, blocco.label)}
                onNuovoCampo={() => onNuovoCampo(blocco.id, blocco.label)}
                onCampoVisibilita={onCampoVisibilita}
                onCampoElimina={onCampoElimina}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function RigaBlocco({
  blocco,
  readonly,
  onVisibilita,
  onElimina,
  onNuovoCampo,
  onCampoVisibilita,
  onCampoElimina,
}: {
  blocco: LayoutBlocco
  readonly: boolean
  onVisibilita: (visible: boolean) => void
  onElimina: () => void
  onNuovoCampo: () => void
  onCampoVisibilita: (id: string, visible: boolean) => void
  onCampoElimina: (id: string, label: string) => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-secondary/30 p-2.5",
        !blocco.visible && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {blocco.label}
        </span>
        {!readonly ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onNuovoCampo}>
              <Plus data-icon="inline-start" />
              Campo
            </Button>
            <BottoneVisibilita visible={blocco.visible} onCambia={onVisibilita} />
            <Button size="icon" variant="ghost" aria-label="Elimina blocco" onClick={onElimina}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {blocco.campi.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">Nessun campo in questo blocco.</p>
      ) : (
        <div
          className={cn(
            "mt-2 grid gap-1.5",
            blocco.colonne === 1 && "grid-cols-1",
            blocco.colonne === 2 && "grid-cols-1 sm:grid-cols-2",
            blocco.colonne >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {blocco.campi.map((campo) => (
            <RigaCampo
              key={campo.id}
              campo={campo}
              readonly={readonly}
              onVisibilita={(v) => onCampoVisibilita(campo.id, v)}
              onElimina={() =>
                onCampoElimina(campo.id, campo.labelOverride ?? campo.fieldKey)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RigaCampo({
  campo,
  readonly,
  onVisibilita,
  onElimina,
}: {
  campo: LayoutCampo
  readonly: boolean
  onVisibilita: (visible: boolean) => void
  onElimina: () => void
}) {
  const calcolato = campo.formula !== null

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5",
        !campo.visible && "opacity-50",
      )}
    >
      {calcolato ? (
        <Sigma
          className="size-3.5 shrink-0 text-info"
          aria-label="Campo calcolato"
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {campo.labelOverride ?? campo.fieldKey}
      </span>
      {campo.origine === "custom" ? (
        <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold uppercase text-muted-foreground">
          custom
        </span>
      ) : null}
      {!readonly ? (
        <div className="flex shrink-0 items-center">
          <BottoneVisibilita visible={campo.visible} onCambia={onVisibilita} />
          <Button size="icon" variant="ghost" aria-label="Togli campo" onClick={onElimina}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function BottoneVisibilita({
  visible,
  onCambia,
}: {
  visible: boolean
  onCambia: (visible: boolean) => void
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={visible ? "Nascondi" : "Mostra"}
      title={visible ? "Nascondi" : "Mostra"}
      onClick={() => onCambia(!visible)}
    >
      {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </Button>
  )
}

function DialogoCreazione({
  dialogo,
  modulo,
  onChiudi,
  onCrea,
}: {
  dialogo: Dialogo
  modulo: LayoutModulo
  onChiudi: () => void
  onCrea: (corpo: Record<string, unknown>) => Promise<void>
}) {
  const [label, setLabel] = useState("")
  const [fieldKey, setFieldKey] = useState("")
  const [tipo, setTipo] = useState<string>("text")
  const [inCorso, setInCorso] = useState(false)

  if (!dialogo) return null

  const titolo =
    dialogo.tipo === "pagina"
      ? `Nuova pagina in ${modulo}`
      : dialogo.tipo === "blocco"
        ? `Nuovo blocco in "${dialogo.paginaLabel}"`
        : `Nuovo campo in "${dialogo.bloccoLabel}"`

  async function conferma() {
    if (!dialogo) return
    setInCorso(true)
    try {
      if (dialogo.tipo === "pagina") {
        await onCrea({ tipo: "pagina", label })
      } else if (dialogo.tipo === "blocco") {
        await onCrea({ tipo: "blocco", paginaId: dialogo.paginaId, label })
      } else {
        await onCrea({
          tipo: "campo",
          bloccoId: dialogo.bloccoId,
          fieldKey: fieldKey.trim(),
          label: label.trim() || undefined,
        })
      }
    } finally {
      setInCorso(false)
    }
  }

  const puoConfermare =
    dialogo.tipo === "campo" ? fieldKey.trim().length > 0 : label.trim().length > 0

  return (
    <Dialog open onOpenChange={(aperto) => (!aperto ? onChiudi() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titolo}</DialogTitle>
          <DialogDescription>
            {dialogo.tipo === "campo"
              ? "Indica la chiave del campo cosi&apos; come e&apos; definita nel modulo. L&apos;etichetta e&apos; facoltativa: senza, si usa quella nativa del campo."
              : "Il nome e' modificabile in seguito; la chiave interna viene derivata ora e resta stabile."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {dialogo.tipo === "campo" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-field-key">Chiave del campo</Label>
                <Input
                  id="layout-field-key"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  placeholder="es. Importo Contrattuale"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-field-label">Etichetta (facoltativa)</Label>
                <Input
                  id="layout-field-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Lascia vuoto per usare quella nativa"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-field-tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v ?? "text")}>
                  <SelectTrigger id="layout-field-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPO_TIPI.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CAMPO_TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Per un campo gia&apos; esistente il tipo resta quello che ha nel modulo: questa scelta
                  vale alla creazione di un campo nuovo.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="layout-label">Nome</Label>
              <Input
                id="layout-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={dialogo.tipo === "pagina" ? "es. Impianto" : "es. Informazioni Tecniche FTV"}
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button onClick={() => void conferma()} disabled={!puoConfermare || inCorso}>
            {inCorso ? <Loader2 className="size-4 animate-spin" /> : null}
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
