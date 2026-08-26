"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Archive, BadgeEuro, BatteryCharging, BookOpenCheck, Bot, Calculator, ChevronDown, ChevronRight, Cloud, Copy, ExternalLink, FileText, FolderOpen, Loader2, Mail, PackageOpen, Pencil, Phone, Plug, Plus, RefreshCw, Save, Search, Settings2, ShieldCheck, SlidersHorizontal, SolarPanel, TicketPercent, Trash2, Upload, User, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { usePermissions } from "@/lib/permissions/provider"
import { deriveRobertaHealth, type RobertaHealthInput, type RobertaHealthLevel } from "@/lib/roberta/health"
import type { AccessorioCommerciale, CatalogoCommerciale, CodiceSconto, DocumentoCommerciale, OffertaCommercialePayload, OffertaPeriodo, PannelloSpec, VersioneCatalogoCommerciale } from "@/lib/offerta-commerciale/types"

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Tonalita' KPI: una per card, tutte prese dalla palette del CRM. */
const TONI_METRICA = {
  navy: "#1e3a5f",
  blue: "#315fc5",
  amber: "#d1861a",
  teal: "#2e8b72",
  slate: "#5b7391",
} as const

/**
 * Card KPI. Con `onClick` o `href` diventa un elemento interattivo che apre la
 * relativa vista in sola lettura: e' l'unico modo che ha un agente senza
 * permesso di gestione per consultare il catalogo, quindi resta cliccabile a
 * prescindere dai permessi.
 */
function Metric({ icon: Icon, label, value, hint, tone = "blue", kind = "number", azione, onClick, href }: { icon: typeof BadgeEuro; label: string; value: string; hint: string; tone?: keyof typeof TONI_METRICA; kind?: "number" | "text"; azione?: string; onClick?: () => void; href?: string }) {
  const contenuto = <>
    <div className="offerta-kpi-head">
      <span className="offerta-kpi-icon"><Icon className="size-5" /></span>
      <span className="offerta-kpi-label">{label}</span>
    </div>
    <div className="offerta-kpi-body">
      <p className="offerta-kpi-value" data-kind={kind} title={kind === "text" ? value : undefined}>{value}</p>
      <div className="offerta-kpi-foot">
        <p className="offerta-kpi-hint">{hint}</p>
        {azione ? <span className="offerta-kpi-azione">{azione}<ChevronRight className="size-3" /></span> : null}
      </div>
    </div>
  </>
  const stile = { "--kpi-tone": TONI_METRICA[tone] } as React.CSSProperties
  if (href) return <a className="offerta-kpi" style={stile} href={href} target="_blank" rel="noreferrer">{contenuto}</a>
  if (onClick) return <button type="button" className="offerta-kpi" style={stile} onClick={onClick}>{contenuto}</button>
  return <article className="offerta-kpi" style={stile}>{contenuto}</article>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{children}</div>
}

function PanelTitle({ icon: Icon, title, description }: { icon: typeof BadgeEuro; title: string; description?: string }) {
  return <div className="mb-4 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Icon className="size-4" /></span><div><h2 className="font-semibold text-foreground">{title}</h2>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div></div>
}

const PANNELLO_VUOTO: PannelloSpec = {
  brand: "",
  modello: "",
  nome_display: "",
  codice: null,
  potenza_wp: null,
  larghezza_mm: null,
  altezza_mm: null,
  peso_kg: null,
  efficienza_pct: null,
  degrado: null,
  garanzia_prodotto_anni: null,
  garanzia_lineare_anni: null,
  tags: [],
  tier: null,
  attivo: true,
  immagine_nc_path: null,
  scheda_pdf_nc_path: null,
}

/**
 * Righe accessorio che normalizeAccessori scarterebbe in silenzio lato server.
 * Vanno intercettate prima del PATCH, altrimenti la voce sparisce senza che
 * l'utente sappia perche'.
 */
type ErroreAccessorio = { index: number; campo: "nome" | "prezzo"; messaggio: string }

function accessoriNonValidi(accessori: AccessorioCommerciale[]): ErroreAccessorio[] {
  return accessori.flatMap((item, index): ErroreAccessorio[] => {
    if (!item.nome.trim()) {
      return [{ index, campo: "nome", messaggio: "Il nome dell'accessorio non può essere vuoto" }]
    }
    if (item.prezzo < 0) {
      return [{ index, campo: "prezzo", messaggio: `Il prezzo di “${item.nome}” non può essere negativo` }]
    }
    return []
  })
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<Input className="mt-1 font-semibold" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>
}

function NumberField({ label, value, onChange, step }: { label: string; value: number | null; onChange: (value: number | null) => void; step?: string }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<Input className="mt-1 font-semibold" type="number" step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : numberValue(e.target.value))} /></label>
}

/** Riquadro upload di un asset pannello: il file finisce su Nextcloud e nel draft resta il path. */
function AssetField({ label, hint, accept, path, busy, disabled, onPick, onClear }: { label: string; hint: string; accept: string; path: string | null; busy: boolean; disabled: boolean; onPick: (file: File) => void; onClear: () => void }) {
  return <div className="rounded-lg border border-dashed border-blue-200 bg-white p-3">
    <p className="text-sm font-medium text-foreground">{label}</p>
    <p className="mt-1 truncate text-xs text-muted-foreground" title={path ?? undefined}>{path ?? hint}</p>
    <div className="mt-2 flex items-center gap-2">
      <label className={`rounded-md border border-input px-3 py-1.5 text-xs font-medium ${disabled ? "opacity-60" : "cursor-pointer hover:bg-slate-50"}`}>
        {busy ? <span className="flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" />Caricamento</span> : path ? "Sostituisci" : "Scegli file"}
        <input className="sr-only" type="file" accept={accept} disabled={disabled} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onPick(file) }} />
      </label>
      {path ? <>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/public/asset?path=${encodeURIComponent(path)}`} target="_blank" rel="noreferrer" />}>Apri</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>Rimuovi</Button>
      </> : null}
    </div>
  </div>
}

/** Pulsante che apre/chiude una sezione a scomparsa, con lo stato leggibile dal chevron. */
function ToggleSezione({ aperta, onToggle, children, tone }: { aperta: boolean; onToggle: () => void; children: React.ReactNode; tone: "blue" | "amber" }) {
  const toni = {
    blue: "border-blue-200 text-blue-800 hover:bg-blue-50 data-[aperta=true]:bg-blue-700 data-[aperta=true]:text-white data-[aperta=true]:border-blue-700",
    amber: "border-amber-200 text-amber-900 hover:bg-amber-50 data-[aperta=true]:bg-amber-600 data-[aperta=true]:text-white data-[aperta=true]:border-amber-600",
  }
  return <Button type="button" variant="outline" data-aperta={aperta} aria-expanded={aperta} onClick={onToggle} className={`shrink-0 bg-white font-bold ${toni[tone]}`}>
    <ChevronDown className={`size-4 transition-transform duration-200 ${aperta ? "rotate-180" : ""}`} />{children}
  </Button>
}

/** Header di una sezione a scomparsa: titolo a sinistra, X di chiusura a destra. */
function HeaderSezione({ icon: Icon, titolo, descrizione, tone, onClose, children }: { icon: typeof BadgeEuro; titolo: string; descrizione: string; tone: "blue" | "amber"; onClose: () => void; children?: React.ReactNode }) {
  const toni = {
    blue: { bordo: "border-blue-100", sfondo: "bg-blue-50/60", icona: "text-blue-700 ring-blue-200", titolo: "text-blue-950", testo: "text-blue-700/80" },
    amber: { bordo: "border-amber-100", sfondo: "bg-amber-50/60", icona: "text-amber-700 ring-amber-200", titolo: "text-amber-950", testo: "text-amber-800/80" },
  }
  const t = toni[tone]
  return <div className={`flex flex-col gap-3 border-b ${t.bordo} ${t.sfondo} p-4 lg:flex-row lg:items-center lg:justify-between`}>
    <div className="flex items-center gap-3">
      <span className={`flex size-10 items-center justify-center rounded-lg bg-white ring-1 ${t.icona}`}><Icon className="size-5" /></span>
      <div>
        <h2 className={`text-lg font-bold ${t.titolo}`}>{titolo}</h2>
        <p className={`mt-1 text-sm font-medium ${t.testo}`}>{descrizione}</p>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {children}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Chiudi ${titolo}`} onClick={onClose}><X className="size-4" /></Button>
    </div>
  </div>
}

/**
 * Raggruppa i documenti sincronizzati da Nextcloud sotto .../Batterie/<Marca>/
 * per marca, mostrando solo le marche presenti a listino (catalogo.accumuli).
 * Il confronto e' case-insensitive e tollerante a piccole differenze di nome
 * cartella (es. "Deye - Vtac" vs marca a listino "Deye").
 */
function raggruppaSchedeBatteria(documenti: DocumentoCommerciale[], marche: string[]) {
  const cartelle = new Map<string, DocumentoCommerciale[]>()
  for (const doc of documenti) {
    const match = doc.path.match(/\/Batterie\/([^/]+)\//)
    if (!match) continue
    const cartella = match[1]
    if (!cartelle.has(cartella)) cartelle.set(cartella, [])
    cartelle.get(cartella)!.push(doc)
  }
  const normalizza = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const marcheNorm = marche.map(normalizza)
  return [...cartelle.entries()]
    .filter(([cartella]) => {
      const n = normalizza(cartella)
      return marcheNorm.some((m) => n.includes(m) || m.includes(n))
    })
    .map(([cartella, files]) => ({ cartella, files }))
    .sort((a, b) => a.cartella.localeCompare(b.cartella))
}

function BatterieSection({ onClose, documenti, marche }: { onClose: () => void; documenti: DocumentoCommerciale[]; marche: string[] }) {
  const gruppi = raggruppaSchedeBatteria(documenti, marche)
  return <section className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
    <HeaderSezione icon={BatteryCharging} titolo="Batterie" descrizione="Schede tecniche degli accumuli, lette dalle cartelle per marca su Nextcloud (solo marche presenti a listino)." tone="amber" onClose={onClose} />
    {gruppi.length === 0 ? <div className="p-4"><Empty>Nessuna scheda trovata per le marche a listino. Verifica di aver sincronizzato dopo aver caricato i file.</Empty></div> : <div className="divide-y divide-border">
      {gruppi.map(({ cartella, files }) => <div key={cartella} className="p-4">
        <div className="mb-2 flex items-center gap-2"><FolderOpen className="size-4 text-amber-700" /><h3 className="font-semibold">{cartella}</h3><Badge variant="outline">{files.length} file</Badge></div>
        <ul className="space-y-1">
          {files.map((doc) => <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-amber-50">
            <span className="truncate">{doc.nome}</span>
            <Button variant="ghost" size="icon-sm" aria-label={`Apri ${doc.nome}`} nativeButton={false} render={<a href={`/api/offerta-commerciale/documenti?path=${encodeURIComponent(doc.path)}`} target="_blank" rel="noreferrer" />}><ExternalLink className="size-4" /></Button>
          </li>)}
        </ul>
      </div>)}
    </div>}
  </section>
}

function PannelliSection({ pannelli, onChange, onClose }: { pannelli: PannelloSpec[]; onChange: (next: PannelloSpec[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<PannelloSpec | null>(null)
  const [draftIndex, setDraftIndex] = useState<number | null>(null)
  const [tagInput, setTagInput] = useState("")
  const [uploading, setUploading] = useState<"immagine" | "scheda" | null>(null)
  // Il form si apre in fondo alla sezione: dentro lo Sheet scrollabile finirebbe
  // fuori schermo e il click sembrerebbe non aver fatto nulla.
  const formRef = useRef<HTMLDivElement | null>(null)
  const [portaInVista, setPortaInVista] = useState(false)

  useEffect(() => {
    if (!portaInVista) return
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    setPortaInVista(false)
  }, [portaInVista])

  const patchDraft = (patch: Partial<PannelloSpec>) => setDraft((current) => current ? { ...current, ...patch } : current)
  const closeDraft = () => { setDraft(null); setDraftIndex(null); setTagInput("") }
  const openNew = () => { setDraft({ ...PANNELLO_VUOTO, tags: [] }); setDraftIndex(null); setTagInput(""); setPortaInVista(true) }
  const openEdit = (index: number) => {
    const pannello = pannelli[index]
    setDraft({ ...pannello, tags: [...(pannello.tags ?? [])] })
    setDraftIndex(index)
    setTagInput("")
    setPortaInVista(true)
  }

  const confirmDraft = () => {
    if (!draft) return
    const nomeDisplay = draft.nome_display.trim() || draft.modello.trim()
    if (!nomeDisplay) { toast.error("Indica almeno il nome visualizzato o il modello"); return }
    const pannello: PannelloSpec = { ...draft, nome_display: nomeDisplay }
    onChange(draftIndex == null ? [...pannelli, pannello] : pannelli.map((item, index) => index === draftIndex ? pannello : item))
    toast.info("Pannello aggiornato: usa “Salva” per applicare le modifiche")
    closeDraft()
  }

  const removePannello = (index: number) => {
    const pannello = pannelli[index]
    if (!window.confirm(`Eliminare il pannello “${pannello.nome_display}”? La rimozione diventa definitiva al salvataggio del catalogo.`)) return
    onChange(pannelli.filter((_, itemIndex) => itemIndex !== index))
    if (draftIndex === index) closeDraft()
  }

  const togglePannello = (index: number, attivo: boolean) =>
    onChange(pannelli.map((item, itemIndex) => itemIndex === index ? { ...item, attivo } : item))

  const addTag = () => {
    const value = tagInput.trim()
    if (!value) return
    setDraft((current) => current && !current.tags.includes(value) ? { ...current, tags: [...current.tags, value] } : current)
    setTagInput("")
  }

  const uploadAsset = async (kind: "immagine" | "scheda", file: File) => {
    setUploading(kind)
    try {
      const form = new FormData()
      form.set("category", "pannelli")
      form.set("file", file)
      const response = await fetch("/api/offerta-commerciale/upload", { method: "POST", body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Upload non riuscito")
      patchDraft(kind === "immagine" ? { immagine_nc_path: body.path } : { scheda_pdf_nc_path: body.path })
      toast.success(`${file.name} caricato su Nextcloud`)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore upload") }
    finally { setUploading(null) }
  }

  return <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
    <HeaderSezione icon={SolarPanel} titolo="Pannelli" descrizione="Schede prodotto pubblicate al configuratore. Le modifiche si applicano con “Salva”." tone="blue" onClose={onClose}>
      <Button type="button" onClick={openNew} className="bg-blue-700 text-white hover:bg-blue-800"><Plus className="size-4" />Aggiungi pannello</Button>
    </HeaderSezione>

    {pannelli.length === 0 ? <div className="p-4"><Empty>Nessun pannello configurato.</Empty></div> : <ul className="divide-y divide-border">
      {pannelli.map((pannello, index) => <li key={`${pannello.codice ?? pannello.nome_display}-${index}`} className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{pannello.nome_display}</p>
          <p className="text-sm text-muted-foreground">{[pannello.brand, pannello.potenza_wp != null ? `${pannello.potenza_wp} Wp` : null].filter(Boolean).join(" · ") || "Dati prodotto non compilati"}</p>
        </div>
        <Badge variant={pannello.attivo ? "default" : "outline"} className={pannello.attivo ? "bg-teal-600" : undefined}>{pannello.attivo ? "Attivo" : "Non attivo"}</Badge>
        <Switch checked={pannello.attivo} onCheckedChange={(checked) => togglePannello(index, checked)} aria-label={`Attiva ${pannello.nome_display}`} />
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Modifica ${pannello.nome_display}`} onClick={() => openEdit(index)}><Pencil className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Elimina ${pannello.nome_display}`} onClick={() => removePannello(index)}><Trash2 className="size-4 text-destructive" /></Button>
      </li>)}
    </ul>}

    {draft ? <div ref={formRef} className="space-y-4 border-t border-blue-100 bg-slate-50/70 p-4">
      <h3 className="font-semibold text-foreground">{draftIndex == null ? "Nuovo pannello" : `Modifica “${pannelli[draftIndex]?.nome_display}”`}</h3>

      <div className="grid gap-3 md:grid-cols-3">
        <TextField label="Brand" value={draft.brand} onChange={(value) => patchDraft({ brand: value })} />
        <TextField label="Modello" value={draft.modello} onChange={(value) => patchDraft({ modello: value })} />
        <TextField label="Nome visualizzato" value={draft.nome_display} placeholder="Ripreso dal modello se vuoto" onChange={(value) => patchDraft({ nome_display: value })} />
        <TextField label="Codice" value={draft.codice ?? ""} onChange={(value) => patchDraft({ codice: value || null })} />
        <NumberField label="Potenza (Wp)" value={draft.potenza_wp} onChange={(value) => patchDraft({ potenza_wp: value })} />
        <TextField label="Tier" value={draft.tier ?? ""} onChange={(value) => patchDraft({ tier: value || null })} />
        <NumberField label="Larghezza (mm)" value={draft.larghezza_mm} onChange={(value) => patchDraft({ larghezza_mm: value })} />
        <NumberField label="Altezza (mm)" value={draft.altezza_mm} onChange={(value) => patchDraft({ altezza_mm: value })} />
        <NumberField label="Peso (kg)" value={draft.peso_kg} step="0.1" onChange={(value) => patchDraft({ peso_kg: value })} />
        <NumberField label="Efficienza (%)" value={draft.efficienza_pct} step="0.01" onChange={(value) => patchDraft({ efficienza_pct: value })} />
        <TextField label="Degrado" value={draft.degrado == null ? "" : String(draft.degrado)} placeholder="es. 0,4%/anno" onChange={(value) => patchDraft({ degrado: value || null })} />
        <NumberField label="Garanzia prodotto (anni)" value={draft.garanzia_prodotto_anni} onChange={(value) => patchDraft({ garanzia_prodotto_anni: value })} />
        <NumberField label="Garanzia lineare (anni)" value={draft.garanzia_lineare_anni} onChange={(value) => patchDraft({ garanzia_lineare_anni: value })} />
        <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium">Attivo<Switch checked={draft.attivo} onCheckedChange={(checked) => patchDraft({ attivo: checked })} /></label>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Tag</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {draft.tags.map((tag) => <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-100 py-1 pl-3 pr-1 text-xs font-semibold text-blue-900">{tag}<button type="button" aria-label={`Rimuovi tag ${tag}`} className="rounded-full p-0.5 hover:bg-blue-200" onClick={() => patchDraft({ tags: draft.tags.filter((item) => item !== tag) })}><X className="size-3" /></button></span>)}
          <Input className="h-8 w-48 bg-white" value={tagInput} placeholder="Aggiungi tag e Invio" onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag() } }} onBlur={addTag} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <AssetField label="Immagine prodotto" hint="Nessuna immagine caricata" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" path={draft.immagine_nc_path} busy={uploading === "immagine"} disabled={uploading != null} onPick={(file) => void uploadAsset("immagine", file)} onClear={() => patchDraft({ immagine_nc_path: null })} />
        <AssetField label="Scheda tecnica PDF" hint="Nessuna scheda caricata" accept="application/pdf,.pdf" path={draft.scheda_pdf_nc_path} busy={uploading === "scheda"} disabled={uploading != null} onPick={(file) => void uploadAsset("scheda", file)} onClear={() => patchDraft({ scheda_pdf_nc_path: null })} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={closeDraft}>Annulla</Button>
        <Button type="button" onClick={confirmDraft} disabled={uploading != null} className="bg-blue-700 text-white hover:bg-blue-800">{draftIndex == null ? "Aggiungi alla lista" : "Applica modifiche"}</Button>
      </div>
    </div> : null}
  </section>
}

type RobertaSourceCategory =
  | "listini"
  | "componenti"
  | "offerte"
  | "prezzi"
  | "finanziarie"
  | "varie"

type RobertaSource = {
  id: string
  label: string
  categoria: RobertaSourceCategory
  path: string
  publicUrl?: string
  active: boolean
}

type RobertaCategoryOption = {
  value: RobertaSourceCategory
  label: string
}

type RobertaBrowseFolder = {
  name: string
  path: string
}

function suggerisciUrlPubblico(path: string) {
  const last = path.split("/").filter(Boolean).pop()?.trim() ?? ""
  const slug = last
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!slug) return ""
  if (slug === "offerta-commerciale" || slug === "offerte") return "https://solairgroup.it/offerte"
  if (slug === "listini") return "https://solairgroup.it/listini"
  return `https://solairgroup.it/${slug}`
}

function RobertaPathInput({ value, onChange, onPick }: { value: string; onChange: (value: string) => void; onPick: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  const [folders, setFolders] = useState<RobertaBrowseFolder[]>([])
  const [pdfCount, setPdfCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState(value.trim() || "Solair")

  const browse = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/crm-settings/roberta/browse?path=${encodeURIComponent(path || "Solair")}`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Lettura cartella non riuscita")
      setCurrentPath(body.path ?? path)
      setFolders(body.folders ?? [])
      setPdfCount(typeof body.pdfCount === "number" ? body.pdfCount : null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lettura cartella non riuscita")
    } finally {
      setLoading(false)
    }
  }, [])

  const openBrowser = () => {
    const path = value.trim() || currentPath || "Solair"
    setOpen(true)
    void browse(path)
  }

  const parentPath = currentPath.split("/").filter(Boolean).slice(0, -1).join("/")
  const canGoUp = parentPath.startsWith("Solair")

  return <div className="relative">
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Path Nextcloud"
      placeholder="Solair/Offerta-Commerciale"
      className="h-10 pr-28 font-semibold"
    />
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 gap-1.5 border border-border bg-white px-2.5 text-slate-700 shadow-sm hover:bg-slate-50"
      onClick={openBrowser}
      aria-expanded={open}
    >
      <FolderOpen className="size-3.5" />Sfoglia
    </Button>
    {open ? <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-slate-50 px-3 py-2">
        <p className="min-w-0 truncate text-xs font-semibold text-slate-700" title={currentPath}>{currentPath}</p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Chiudi sfoglia path" onClick={() => setOpen(false)}><X className="size-4" /></Button>
      </div>
      <div className="max-h-72 overflow-y-auto p-1.5">
        {canGoUp ? <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => void browse(parentPath)}>
          <ChevronRight className="size-4 rotate-180" />Cartella superiore
        </button> : null}
        {folders.map((folder) => <button
          type="button"
          key={folder.path}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-800"
          onClick={() => {
            onPick(folder.path)
            setOpen(false)
          }}
        >
          <FolderOpen className="size-4 text-blue-600" />
          <span className="min-w-0 truncate">{folder.name}</span>
        </button>)}
        {!loading && folders.length === 0 ? <p className="px-2.5 py-4 text-sm text-muted-foreground">Nessuna sottocartella disponibile.</p> : null}
        {loading ? <p className="flex items-center gap-2 px-2.5 py-4 text-sm font-medium text-muted-foreground"><Loader2 className="size-4 animate-spin" />Lettura cartelle</p> : null}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
        <span>{pdfCount == null ? "PDF non letti" : `${pdfCount} PDF in questa cartella`}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => { onPick(currentPath); setOpen(false) }}>Usa questa</Button>
      </div>
    </div> : null}
  </div>
}

function RobertaSourcesPanel() {
  const [sources, setSources] = useState<RobertaSource[]>([])
  const [categories, setCategories] = useState<RobertaCategoryOption[]>([])
  const [status, setStatus] = useState<RobertaHealthInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const health = deriveRobertaHealth(status)
  const healthToneByLevel: Record<RobertaHealthLevel, string> = {
    green: "border-teal-200 bg-teal-50 text-teal-800",
    yellow: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
  }
  const healthTone = healthToneByLevel[health.level]

  const loadSources = useCallback(async () => {
    setLoading(true)
    try {
      const [sourcesResponse, statusResponse] = await Promise.all([
        fetch("/api/crm-settings/roberta/sources", { cache: "no-store" }),
        fetch("/api/crm-settings/roberta/knowledge/sync", { cache: "no-store" }),
      ])
      const sourcesBody = await sourcesResponse.json()
      const statusBody = await statusResponse.json()
      if (!sourcesResponse.ok) throw new Error(sourcesBody.error ?? "Errore fonti RobertaBot")
      if (!statusResponse.ok) throw new Error(statusBody.error ?? "Errore stato RobertaBot")
      setSources(sourcesBody.sources ?? [])
      setCategories(sourcesBody.categories ?? [])
      setStatus(statusBody)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore fonti RobertaBot")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const patchSource = (id: string, patch: Partial<RobertaSource>) => {
    setSources((current) => current.map((source) => source.id === id ? { ...source, ...patch } : source))
  }

  const addSource = () => {
    setSources((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "Nuova fonte",
        categoria: "listini",
        path: "",
        publicUrl: "",
        active: true,
      },
    ])
  }

  const saveSources = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/crm-settings/roberta/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Errore salvataggio fonti")
      setSources(body.sources ?? sources)
      toast.success("Fonti RobertaBot salvate")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio fonti")
    } finally {
      setSaving(false)
    }
  }

  const syncKnowledge = async () => {
    setSyncing(true)
    try {
      const saveResponse = await fetch("/api/crm-settings/roberta/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources }),
      })
      const saveBody = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saveBody.error ?? "Errore salvataggio fonti")
      setSources(saveBody.sources ?? sources)

      const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Errore sincronizzazione RobertaBot")
      await loadSources()
      toast.success(`RobertaBot aggiornata: ${body.updated} documenti aggiornati, ${body.reused} invariati`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore sincronizzazione RobertaBot")
    } finally {
      setSyncing(false)
    }
  }

  return <section className="overflow-visible rounded-xl border border-violet-100 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-violet-100 bg-violet-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-white text-violet-700 ring-1 ring-violet-200"><Bot className="size-5" /></span>
        <div>
          <h2 className="text-lg font-bold text-violet-950">Fonti RobertaBot</h2>
          <p className="mt-1 text-sm font-medium text-violet-800/80">Cartelle Nextcloud autorizzate per la conoscenza del bot.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold ${healthTone}`} title={health.summary}>
          <span className="size-3 rounded-full bg-current shadow-[0_0_0_4px_color-mix(in_srgb,currentColor_16%,transparent)]" />
          {loading ? "Controllo" : health.label}
        </div>
        <Button type="button" variant="outline" onClick={addSource}><Plus className="size-4" />Aggiungi fonte</Button>
        <Button type="button" variant="outline" onClick={() => void saveSources()} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salva fonti</Button>
        <Button type="button" onClick={() => void syncKnowledge()} disabled={syncing || saving || loading} className="bg-violet-700 text-white hover:bg-violet-800">{syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Salva e sincronizza</Button>
      </div>
    </div>

    {loading ? <div className="flex items-center gap-2 p-5 text-sm font-medium text-muted-foreground"><Loader2 className="size-4 animate-spin" />Caricamento fonti</div> : null}
    {!loading && sources.length === 0 ? <div className="p-4"><Empty>Nessuna fonte configurata.</Empty></div> : null}
    {!loading && sources.length > 0 ? <div className="divide-y divide-border">
      {sources.map((source) => <article key={source.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_170px_minmax(280px,1.4fr)_minmax(260px,1fr)_auto_auto] lg:items-end">
        <label className="text-xs font-medium text-muted-foreground">Nome
          <Input className="mt-1 h-10 font-semibold" value={source.label} onChange={(event) => patchSource(source.id, { label: event.target.value })} />
        </label>
        <label className="text-xs font-medium text-muted-foreground">Categoria
          <Select value={source.categoria} onValueChange={(value) => patchSource(source.id, { categoria: value as RobertaSourceCategory })}>
            <SelectTrigger className="mt-1 h-10 w-full bg-white font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Path Nextcloud
          <div className="mt-1">
            <RobertaPathInput
              value={source.path}
              onChange={(path) => patchSource(source.id, { path })}
              onPick={(path) => patchSource(source.id, { path, publicUrl: source.publicUrl?.trim() ? source.publicUrl : suggerisciUrlPubblico(path) })}
            />
          </div>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Link pubblico
          <Input className="mt-1 h-10 font-semibold" value={source.publicUrl ?? ""} placeholder="https://solairgroup.it/..." onChange={(event) => patchSource(source.id, { publicUrl: event.target.value })} />
        </label>
        <label className="flex h-10 items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 text-sm font-medium">
          Attiva
          <Switch checked={source.active} onCheckedChange={(active) => patchSource(source.id, { active })} aria-label={`Fonte ${source.label} attiva`} />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={`Rimuovi ${source.label}`}
          onClick={() => setSources((current) => current.filter((item) => item.id !== source.id))}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </article>)}
    </div> : null}
  </section>
}

const CONFIGURATORE_URL = "https://solairgroup.it/configuratore-solair-v11.html"

type LeadPreventivo = {
  id: string
  nome_lead: string | null
  nome: string | null
  cognome: string | null
  email: string | null
  telefono: string | null
}

type NuovoLead = { nome: string; cognome: string; telefono: string; email: string }

const NUOVO_LEAD_VUOTO: NuovoLead = { nome: "", cognome: "", telefono: "", email: "" }

/**
 * Nome e cognome separati da passare al configuratore. I lead importati da Zoho
 * hanno spesso solo nome_lead valorizzato: in quel caso lo si spezza, altrimenti
 * il configuratore riceverebbe due campi vuoti.
 */
function contattoLead(lead: LeadPreventivo): { nome: string; cognome: string } {
  const nome = lead.nome?.trim() ?? ""
  const cognome = lead.cognome?.trim() ?? ""
  if (nome || cognome) return { nome, cognome }
  const parti = (lead.nome_lead ?? "").trim().split(/\s+/).filter(Boolean)
  return { nome: parti[0] ?? "", cognome: parti.slice(1).join(" ") }
}

function etichettaLead(lead: LeadPreventivo) {
  const { nome, cognome } = contattoLead(lead)
  return lead.nome_lead?.trim() || [nome, cognome].filter(Boolean).join(" ") || "Lead senza nome"
}

function DatoContatto({ icon: Icon, valore, vuoto }: { icon: typeof BadgeEuro; valore: string | null; vuoto: string }) {
  return <span className={`flex items-center gap-1.5 text-sm ${valore ? "text-slate-700" : "text-muted-foreground"}`}>
    <Icon className="size-3.5 shrink-0" />{valore || vuoto}
  </span>
}

/**
 * Punto di partenza del preventivo: si individua il cliente (lead esistente o
 * nuovo) e si passa al configuratore pubblico, che e' l'unico posto dove il
 * prezzo viene calcolato. Il lead nuovo viene scritto a database solo alla
 * finalizzazione: finche' si compila il form non resta traccia di nulla.
 */
function SezioneCliente() {
  const [query, setQuery] = useState("")
  const [risultati, setRisultati] = useState<LeadPreventivo[]>([])
  const [cercando, setCercando] = useState(false)
  const [ricercaEseguita, setRicercaEseguita] = useState(false)
  const [selezionato, setSelezionato] = useState<LeadPreventivo | null>(null)
  const [nuovo, setNuovo] = useState<NuovoLead | null>(null)
  const [finalizzando, setFinalizzando] = useState(false)

  const termine = query.trim()
  // Con un lead scelto o il form aperto la ricerca e' ferma: come booleano, il
  // form in compilazione non fa ripartire l'effetto a ogni tasto premuto.
  const ricercaSospesa = selezionato != null || nuovo != null

  useEffect(() => {
    if (ricercaSospesa || termine.length < 2) {
      setRisultati([])
      setRicercaEseguita(false)
      setCercando(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setCercando(true)
      try {
        const response = await fetch(`/api/offerta-commerciale/preventivo?q=${encodeURIComponent(termine)}`, { signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? "Ricerca non riuscita")
        setRisultati((body.rows ?? []) as LeadPreventivo[])
        setRicercaEseguita(true)
      } catch (error) {
        if (controller.signal.aborted) return
        toast.error(error instanceof Error ? error.message : "Errore ricerca lead")
      } finally {
        if (!controller.signal.aborted) setCercando(false)
      }
    }, 300)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [termine, ricercaSospesa])

  const apriNuovo = () => {
    // Il testo cercato e' quasi sempre il nome: si porta nel form invece di
    // farlo riscrivere.
    setNuovo({ ...NUOVO_LEAD_VUOTO, nome: termine.length >= 2 && !termine.includes("@") && !/\d/.test(termine) ? termine : "" })
    setSelezionato(null)
  }

  const azzera = () => { setSelezionato(null); setNuovo(null); setQuery("") }

  const nuovoValido = nuovo != null && nuovo.nome.trim().length > 0 && nuovo.telefono.trim().length > 0
  const puoFinalizzare = selezionato != null || nuovoValido

  const finalizza = async () => {
    if (!puoFinalizzare) return
    setFinalizzando(true)
    // La scheda va aperta nello stesso gesto del click: aprirla dopo l'await la
    // farebbe scartare dal blocco popup del browser.
    const scheda = window.open("", "_blank")
    if (scheda) scheda.opener = null
    try {
      const response = await fetch("/api/offerta-commerciale/preventivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selezionato ? { leadId: selezionato.id } : { nuovo }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Finalizzazione non riuscita")
      const lead = body.lead as LeadPreventivo
      const { nome, cognome } = contattoLead(lead)
      const parametri = new URLSearchParams({ nome, cognome, email: lead.email ?? "", telefono: lead.telefono ?? "" })
      const url = `${CONFIGURATORE_URL}?${parametri.toString()}`
      if (scheda) scheda.location.href = url
      else window.open(url, "_blank", "noopener,noreferrer")
      toast.success(body.creato ? `Lead “${etichettaLead(lead)}” creato: configuratore aperto` : `Preventivo tracciato su “${etichettaLead(lead)}”: configuratore aperto`)
      if (body.attivitaRegistrata === false) toast.warning("Configuratore aperto, ma l'attività non è stata registrata sul lead")
      setSelezionato(lead)
      setNuovo(null)
    } catch (error) {
      scheda?.close()
      toast.error(error instanceof Error ? error.message : "Errore finalizzazione preventivo")
    } finally { setFinalizzando(false) }
  }

  return <section className="offerta-panel">
    <div className="offerta-panel-head">
      <span className="offerta-panel-icon"><User className="size-5" /></span>
      <div className="min-w-0">
        <h2 className="offerta-panel-title">Cliente</h2>
        <p className="offerta-panel-subtitle">Cerca il lead o creane uno nuovo: il preventivo si compila nel configuratore pubblico.</p>
      </div>
    </div>

    <div className="p-5">
      {/* key sull'id: cambiando lead il nodo si rimonta e l'animazione di
          comparsa riparte, altrimenti la seconda selezione sarebbe muta. */}
      {selezionato ? <div key={selezionato.id} className="offerta-lead-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="offerta-lead-badge"><ShieldCheck className="size-3" />Lead selezionato</span>
            <p className="offerta-lead-name truncate">{etichettaLead(selezionato)}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <DatoContatto icon={Phone} valore={selezionato.telefono} vuoto="Telefono non indicato" />
              <DatoContatto icon={Mail} valore={selezionato.email} vuoto="E-mail non indicata" />
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={azzera}><X className="size-4" />Cambia cliente</Button>
        </div>
      </div> : nuovo ? <div className="offerta-lead-card" style={{ "--lead-tone": "#2e8b72" } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UserPlus className="size-4 text-teal-700" />
            <h3 className="text-base font-extrabold tracking-tight text-teal-950">Nuovo lead</h3>
          </div>
          <Button type="button" variant="ghost" onClick={azzera}><X className="size-4" />Annulla</Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TextField label="Nome *" value={nuovo.nome} onChange={(value) => setNuovo({ ...nuovo, nome: value })} />
          <TextField label="Cognome" value={nuovo.cognome} onChange={(value) => setNuovo({ ...nuovo, cognome: value })} />
          <TextField label="Telefono *" value={nuovo.telefono} onChange={(value) => setNuovo({ ...nuovo, telefono: value })} />
          <TextField label="E-mail" value={nuovo.email} onChange={(value) => setNuovo({ ...nuovo, email: value })} />
        </div>
        <p className="mt-3 text-xs font-medium text-teal-800/80">Il lead viene creato nel CRM solo alla finalizzazione del preventivo.</p>
      </div> : <div>
        <label className="offerta-field-label" htmlFor="ricerca-lead">Cerca per nome, telefono o e-mail</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input id="ricerca-lead" className="offerta-search-input pl-10" value={query} placeholder="Es. Mario Rossi, 3401234567, mario@..." onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
          {cercando ? <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#315fc5]" /> : null}
        </div>

        {risultati.length > 0 ? <ul className="offerta-reveal mt-3 space-y-2">
          {risultati.map((lead) => <li key={lead.id}>
            <button type="button" className="offerta-result" onClick={() => { setSelezionato(lead); setRisultati([]) }}>
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-bold text-slate-900">{etichettaLead(lead)}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <DatoContatto icon={Phone} valore={lead.telefono} vuoto="—" />
                  <DatoContatto icon={Mail} valore={lead.email} vuoto="—" />
                </span>
              </span>
              <Badge variant="outline" className="shrink-0 bg-white">Seleziona</Badge>
            </button>
          </li>)}
        </ul> : null}

        {ricercaEseguita && !cercando && risultati.length === 0 ? <p className="offerta-reveal mt-3 rounded-lg border border-amber-200/70 bg-gradient-to-b from-amber-50 to-amber-50/40 p-3 text-sm font-medium text-amber-900">Nessun lead trovato per “{termine}”.</p> : null}
        {termine.length > 0 && termine.length < 2 ? <p className="mt-3 text-sm text-muted-foreground">Scrivi almeno 2 caratteri per cercare.</p> : null}

        <div className="offerta-divider my-4">oppure</div>

        <Button type="button" variant="outline" className="h-10 w-full border-dashed bg-white font-bold text-slate-700 hover:border-solid hover:bg-slate-50 sm:w-auto" onClick={apriNuovo}><UserPlus className="size-4" />Nuovo lead</Button>
      </div>}
    </div>

    <div className="offerta-footer">
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">Alla finalizzazione il contatto viene tracciato sul lead e il configuratore si apre in una nuova scheda con i dati già compilati.</p>
      <Button type="button" variant="ghost" className="offerta-cta" data-busy={finalizzando} disabled={!puoFinalizzare || finalizzando} onClick={() => void finalizza()}>
        {finalizzando ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}Finalizza preventivo
      </Button>
    </div>
  </section>
}

const FORMATO_EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const FORMATO_NUMERO = new Intl.NumberFormat("it-IT")

function euro(value: number | null | undefined) {
  return value == null ? "—" : FORMATO_EURO.format(value)
}

/** Un accessorio puo' essere quotato in €, in €/kWp o a corpo: l'unita' decide il formato. */
function prezzoAccessorio(value: number | null | undefined, unita: string) {
  if (value == null) return "—"
  const misura = unita.trim()
  return !misura || misura === "€" ? FORMATO_EURO.format(value) : `${FORMATO_NUMERO.format(value)} ${misura}`
}

function periodoOfferta(offer: OffertaPeriodo) {
  const dal = offer.valido_dal ? new Date(offer.valido_dal).toLocaleDateString("it-IT") : null
  const al = offer.valido_al ? new Date(offer.valido_al).toLocaleDateString("it-IT") : null
  if (!dal && !al) return "Sempre valida"
  return `${dal ?? "Data inizio libera"} – ${al ?? "senza scadenza"}`
}

async function copiaNegliAppunti(value: string, successMessage: string) {
  const testo = value.trim()
  if (!testo) return
  try {
    await navigator.clipboard.writeText(testo)
    toast.success(successMessage)
  } catch {
    toast.error("Copia non riuscita")
  }
}

function OffertaAdminCard({
  offer,
  generatingPublicLink,
  onPatch,
  onSave,
  onGeneratePublicLink,
}: {
  offer: OffertaPeriodo
  generatingPublicLink: boolean
  onPatch: (patch: Partial<OffertaPeriodo>) => void
  onSave: () => void
  onGeneratePublicLink: () => void
}) {
  const publicUrl = offer.url_pubblico?.trim() ?? ""

  return <article className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
    {offer.cover_path ? <img src={`/api/offerta-commerciale/offerte/${offer.id}/asset?kind=cover`} alt="" className="h-52 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-slate-100"><FileText className="size-10 text-muted-foreground" /></div>}
    <div className="space-y-3 p-4">
      <Input value={offer.titolo} onChange={(e) => onPatch({ titolo: e.target.value })} />
      <Textarea value={offer.descrizione ?? ""} onChange={(e) => onPatch({ descrizione: e.target.value })} placeholder="Descrizione breve" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={offer.valido_dal ?? ""} onChange={(e) => onPatch({ valido_dal: e.target.value || null })} />
        <Input type="date" value={offer.valido_al ?? ""} onChange={(e) => onPatch({ valido_al: e.target.value || null })} />
      </div>

      <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-3">
        <label className="text-xs font-medium text-teal-900">
          URL pubblico PDF
          <Input
            className="mt-1 bg-white font-semibold"
            value={offer.url_pubblico ?? ""}
            placeholder={offer.pdf_path ? "Genera il link pubblico Nextcloud" : "Carica un PDF per generare il link"}
            onChange={(e) => onPatch({ url_pubblico: e.target.value || null })}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onGeneratePublicLink} disabled={!offer.pdf_path || generatingPublicLink}>
            {generatingPublicLink ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
            Genera link
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copiaNegliAppunti(publicUrl, "URL pubblico copiato")} disabled={!publicUrl}>
            <Copy className="size-4" />
            Copia
          </Button>
          {publicUrl ? <Button variant="ghost" size="sm" nativeButton={false} render={<a href={publicUrl} target="_blank" rel="noreferrer" />}><ExternalLink className="size-4" />Apri pubblico</Button> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><Switch checked={offer.pubblicata} onCheckedChange={(checked) => onPatch({ pubblicata: checked })} />Pubblicata</label>
        <div className="flex gap-2">
          {offer.pdf_path ? <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/offerta-commerciale/offerte/${offer.id}/asset`} target="_blank" rel="noreferrer" />}>Apri PDF</Button> : null}
          <Button size="sm" onClick={onSave} className="bg-teal-600 hover:bg-teal-700">Salva</Button>
        </div>
      </div>
    </div>
  </article>
}

type CategoriaUpload = "listini" | "offerte" | "schede" | "pannelli"

const UPLOAD_CATEGORIES: Array<{
  key: CategoriaUpload
  title: string
  hint: string
  accept: string
  multiple?: boolean
  className: string
}> = [
  {
    key: "listini",
    title: "Listini",
    hint: "PDF che alimentano storico e listino corrente",
    accept: "application/pdf,.pdf",
    className: "border-blue-200 bg-blue-50/50 hover:bg-blue-50",
  },
  {
    key: "offerte",
    title: "Offerte del periodo",
    hint: "PDF, JPG, PNG o WebP",
    accept: "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp",
    multiple: true,
    className: "border-teal-200 bg-teal-50/50 hover:bg-teal-50",
  },
  {
    key: "schede",
    title: "Schede tecniche",
    hint: "Solo PDF",
    accept: "application/pdf,.pdf",
    multiple: true,
    className: "border-slate-200 bg-slate-50 hover:bg-slate-100",
  },
  {
    key: "pannelli",
    title: "Pannelli",
    hint: "Immagini e schede PDF dei pannelli",
    accept: "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp",
    multiple: true,
    className: "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50",
  },
]

function dataBreve(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "—"
}

function nomeDaPath(value: string | null | undefined) {
  return value?.split("/").pop() || "PDF non collegato"
}

function dimensioneDocumento(kb: number | null | undefined) {
  if (kb == null) return "—"
  return kb >= 1024 ? `${FORMATO_NUMERO.format(Math.round(kb / 102.4) / 10)} MB` : `${FORMATO_NUMERO.format(kb)} KB`
}

function UploadTile({ config, uploading, onUpload }: { config: (typeof UPLOAD_CATEGORIES)[number]; uploading: boolean; onUpload: (category: CategoriaUpload, files: FileList | null) => void }) {
  return <label className={`flex min-h-28 cursor-pointer flex-col justify-between rounded-lg border border-dashed p-4 text-sm transition-colors ${config.className} ${uploading ? "pointer-events-none opacity-60" : ""}`}>
    <span>
      <span className="flex items-center gap-2 font-bold text-foreground"><Upload className="size-4" />{config.title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{config.hint}</span>
    </span>
    <span className="mt-3 text-xs font-semibold text-blue-700">{uploading ? "Caricamento..." : "Scegli file"}</span>
    <input className="sr-only" type="file" multiple={config.multiple} accept={config.accept} disabled={uploading} onChange={(e) => { onUpload(config.key, e.target.files); e.target.value = "" }} />
  </label>
}

function StatoListinoBadge({ stato }: { stato: CatalogoCommerciale["stato"] }) {
  if (stato === "pubblicato") return <Badge className="bg-teal-600">Pubblicato</Badge>
  if (stato === "archiviato") return <Badge variant="outline" className="bg-white text-slate-600">Archiviato</Badge>
  return <Badge variant="secondary">Bozza</Badge>
}

function StoricoListini({
  versioni,
  catalogoId,
  deletingCatalog,
  publishingCatalog,
  onDelete,
  onPublish,
}: {
  versioni: VersioneCatalogoCommerciale[]
  catalogoId: string
  deletingCatalog: string | null
  publishingCatalog: string | null
  onDelete: (id: string, name: string) => void
  onPublish: (id: string, name: string) => void
}) {
  if (versioni.length === 0) return <Empty>Nessun listino nello storico.</Empty>
  return <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
    <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Archive className="size-4 text-blue-700" />
        <h2 className="font-semibold">Storico listini</h2>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{versioni.length} versioni CRM</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-4 py-3">Listino</th>
            <th className="px-4 py-3">Stato</th>
            <th className="px-4 py-3">Validità</th>
            <th className="px-4 py-3">Aggiornato</th>
            <th className="px-4 py-3 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>{versioni.map((version) => {
          const inUso = version.id === catalogoId
          return <tr key={version.id} className="border-t border-border align-top">
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{version.nome}</span>
                {inUso ? <Badge className="bg-blue-700">In uso</Badge> : null}
              </div>
              <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground" title={version.fonte_path ?? undefined}>{nomeDaPath(version.fonte_path)}</div>
            </td>
            <td className="px-4 py-3"><StatoListinoBadge stato={version.stato} /></td>
            <td className="px-4 py-3 text-muted-foreground">{dataBreve(version.valido_dal)} - {dataBreve(version.valido_al)}</td>
            <td className="px-4 py-3 text-muted-foreground">
              <div>{dataBreve(version.aggiornato_at)}</div>
              {version.pubblicato_at ? <div className="mt-1 text-xs">pubblicato {dataBreve(version.pubblicato_at)}</div> : null}
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                {version.fonte_path ? <Button variant="ghost" size="icon-sm" aria-label={`Apri PDF ${version.nome}`} nativeButton={false} render={<a href={`/api/offerta-commerciale/documenti?path=${encodeURIComponent(version.fonte_path)}`} target="_blank" rel="noreferrer" />}><FileText className="size-4" /></Button> : null}
                {version.stato === "archiviato" ? <Button variant="ghost" size="icon-sm" aria-label={`Ripubblica ${version.nome}`} title={`Ripubblica ${version.nome}`} disabled={publishingCatalog === version.id || deletingCatalog === version.id} onClick={() => onPublish(version.id, version.nome)}>{publishingCatalog === version.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4 text-blue-700" />}</Button> : null}
                {version.stato === "archiviato" ? <Button variant="ghost" size="icon-sm" aria-label={`Elimina ${version.nome}`} disabled={deletingCatalog === version.id} onClick={() => onDelete(version.id, version.nome)}>{deletingCatalog === version.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}</Button> : null}
              </div>
            </td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </section>
}

function DocumentiNextcloud({ documenti, fonteAttiva, deletingDocument, onDelete }: { documenti: DocumentoCommerciale[]; fonteAttiva: string | null; deletingDocument: string | null; onDelete: (path: string, name: string) => void }) {
  if (documenti.length === 0) return <Empty>Nessun documento sincronizzato da Nextcloud.</Empty>
  return <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
    <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Cloud className="size-4 text-blue-700" />
        <h2 className="font-semibold">Documenti Nextcloud</h2>
      </div>
      <p className="text-xs font-medium text-muted-foreground">Il cestino elimina il file e riallinea il CRM</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-4 py-3">Documento</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Dimensione</th>
            <th className="px-4 py-3">Modificato</th>
            <th className="px-4 py-3 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>{documenti.map((doc) => {
          const attivo = doc.path === fonteAttiva
          const deleting = deletingDocument === doc.path
          return <tr key={doc.id} className="border-t border-border align-top">
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{doc.nome}</span>
                {attivo ? <Badge className="bg-blue-700">Listino in uso</Badge> : null}
              </div>
              <div className="mt-1 max-w-[420px] truncate text-xs text-muted-foreground" title={doc.path}>{doc.path}</div>
            </td>
            <td className="px-4 py-3"><Badge variant="outline">{doc.tipo}</Badge></td>
            <td className="px-4 py-3 text-muted-foreground">{dimensioneDocumento(doc.dimensione_kb)}</td>
            <td className="px-4 py-3 text-muted-foreground">{dataBreve(doc.modificato_at)}</td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Apri ${doc.nome}`} nativeButton={false} render={<a href={`/api/offerta-commerciale/documenti?path=${encodeURIComponent(doc.path)}`} target="_blank" rel="noreferrer" />}><ExternalLink className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Elimina ${doc.nome}`} title={attivo ? "Non puoi eliminare il PDF del listino in uso" : undefined} disabled={deleting || attivo} onClick={() => onDelete(doc.path, doc.nome)}>{deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className={`size-4 ${attivo ? "text-muted-foreground" : "text-destructive"}`} />}</Button>
              </div>
            </td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </section>
}

function TesterPrezzoAccumulo({ catalogo }: { catalogo: CatalogoCommerciale }) {
  const [kwpValue, setKwpValue] = useState(() => String(catalogo.fotovoltaico[0]?.kwp ?? ""))
  const [marca, setMarca] = useState(() => catalogo.accumuli[0]?.marca ?? "")
  const accumulo = catalogo.accumuli.find((item) => item.marca === marca) ?? catalogo.accumuli[0] ?? null
  const [kwhValue, setKwhValue] = useState(() => String(accumulo?.taglie[0] ?? ""))

  useEffect(() => {
    if (catalogo.fotovoltaico.length > 0 && !catalogo.fotovoltaico.some((row) => String(row.kwp) === kwpValue)) {
      setKwpValue(String(catalogo.fotovoltaico[0].kwp))
    }
    if (catalogo.accumuli.length > 0 && !catalogo.accumuli.some((item) => item.marca === marca)) {
      setMarca(catalogo.accumuli[0].marca)
    }
  }, [catalogo.accumuli, catalogo.fotovoltaico, kwpValue, marca])

  useEffect(() => {
    if (accumulo && !accumulo.taglie.some((taglia) => String(taglia) === kwhValue)) {
      setKwhValue(String(accumulo.taglie[0] ?? ""))
    }
  }, [accumulo, kwhValue])

  if (catalogo.fotovoltaico.length === 0 || catalogo.accumuli.length === 0 || !accumulo) return null

  const kwp = Number(kwpValue)
  const kwh = Number(kwhValue)
  const base = catalogo.fotovoltaico.find((row) => row.kwp === kwp)?.prezzo ?? null
  const indiceKwh = accumulo.taglie.findIndex((taglia) => Math.abs(taglia - kwh) < 0.001)
  const sovrapprezzo = indiceKwh >= 0 ? accumulo.prezzi[String(kwp)]?.[indiceKwh] ?? null : null
  const totale = base != null && sovrapprezzo != null ? base + sovrapprezzo : null
  const tagliaDerivata = kwp < 6 || kwp === 10

  return <section className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-lg font-bold text-amber-950">Prova prezzo accumulo</h2>
        <p className="mt-1 text-sm font-medium text-amber-800/80">Verifica immediata delle righe derivate dal listino.</p>
      </div>
      {tagliaDerivata ? <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-amber-900">Taglia da regole</Badge> : <Badge variant="outline" className="w-fit border-teal-200 bg-teal-50 text-teal-800">Taglia in tabella</Badge>}
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-[140px_minmax(160px,1fr)_150px]">
      <label className="text-xs font-medium text-muted-foreground">Impianto
        <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground" value={kwpValue} onChange={(event) => setKwpValue(event.target.value)}>
          {catalogo.fotovoltaico.map((row) => <option key={row.kwp} value={row.kwp}>{FORMATO_NUMERO.format(row.kwp)} kWp</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">Marca accumulo
        <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground" value={marca} onChange={(event) => setMarca(event.target.value)}>
          {catalogo.accumuli.map((item) => <option key={item.marca} value={item.marca}>{item.marca}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">Capacità
        <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground" value={kwhValue} onChange={(event) => setKwhValue(event.target.value)}>
          {accumulo.taglie.map((taglia) => <option key={taglia} value={taglia}>{FORMATO_NUMERO.format(taglia)} kWh</option>)}
        </select>
      </label>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">FV</p>
        <p className="mt-1 text-lg font-extrabold text-slate-950">{euro(base)}</p>
      </div>
      <div className="rounded-lg border border-border bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">Accumulo</p>
        <p className="mt-1 text-lg font-extrabold text-slate-950">{euro(sovrapprezzo)}</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-bold uppercase text-amber-800">Totale</p>
        <p className="mt-1 text-lg font-extrabold text-amber-950">{euro(totale)}</p>
      </div>
    </div>
  </section>
}

type VistaCatalogo = "fv" | "accumuli" | "accessori" | "offerte"

const VISTE_CATALOGO: Record<VistaCatalogo, { icona: typeof BadgeEuro; titolo: string; descrizione: string }> = {
  fv: { icona: SolarPanel, titolo: "Taglie FV", descrizione: "Prezzo dell'impianto fotovoltaico senza accumulo, IVA inclusa." },
  accumuli: { icona: BatteryCharging, titolo: "Accumuli", descrizione: "Sovrapprezzo dell'accumulo per marca e taglia dell'impianto." },
  accessori: { icona: Plug, titolo: "Accessori", descrizione: "Voci pubblicate al configuratore con il relativo prezzo." },
  offerte: { icona: PackageOpen, titolo: "Offerte del periodo", descrizione: "Offerte pubblicate, con il PDF da mostrare al cliente." },
}

/**
 * Consultazione del catalogo aperta dalle card KPI: nessun campo modificabile e
 * nessun salvataggio, quindi resta disponibile anche senza
 * "offerta_commerciale.manage". I dati sono gia' nel payload della pagina.
 */
function VistaCatalogoSheet({ vista, onChiudi, catalogo, offerte, documenti }: { vista: VistaCatalogo | null; onChiudi: () => void; catalogo: CatalogoCommerciale; offerte: OffertaPeriodo[]; documenti: DocumentoCommerciale[] }) {
  const meta = vista ? VISTE_CATALOGO[vista] : null
  const Icona = meta?.icona ?? BookOpenCheck
  const accessori = catalogo.accessori.filter((item) => item.nome.trim() && item.prezzo >= 0)

  return <Sheet open={vista != null} onOpenChange={(open) => { if (!open) onChiudi() }}>
    <SheetContent className="max-w-none overflow-y-auto bg-slate-50 p-0 data-[side=right]:!w-[92vw] sm:!max-w-[640px]" showCloseButton>
      <SheetHeader className="border-b bg-white px-6 py-5 pr-14">
        <SheetTitle className="flex items-center gap-2 text-xl"><Icona className="size-5 text-blue-700" />{meta?.titolo ?? "Catalogo"}</SheetTitle>
        <SheetDescription>{meta?.descrizione}</SheetDescription>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary"><ShieldCheck className="size-3.5" />Sola lettura</Badge>
          <Badge variant="outline" className="bg-white text-blue-700">{catalogo.nome}</Badge>
        </div>
      </SheetHeader>

      <div className="space-y-4 p-5">
        {vista === "fv" ? (catalogo.fotovoltaico.length === 0 ? <Empty>Nessuna taglia a listino.</Empty> : <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3 font-bold">Potenza</th><th className="px-4 py-3 text-right font-bold">Prezzo</th></tr></thead>
            <tbody>{catalogo.fotovoltaico.map((row, index) => <tr key={index} className="border-t border-border">
              <td className="px-4 py-2.5 font-semibold">{FORMATO_NUMERO.format(row.kwp)} kWp</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{euro(row.prezzo)}</td>
            </tr>)}</tbody>
          </table>
        </section>) : null}

        {vista === "accumuli" ? (catalogo.accumuli.length === 0 ? <Empty>Nessun accumulo in catalogo.</Empty> : catalogo.accumuli.map((battery) => <section key={battery.marca} className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50/60 p-4">
            <h3 className="text-base font-bold text-amber-950">{battery.marca}</h3>
            <p className="mt-0.5 text-sm font-medium text-amber-800/80">{[battery.tensione, battery.ip, battery.garanzia_anni ? `${battery.garanzia_anni} anni di garanzia` : null].filter(Boolean).join(" · ") || "Sovrapprezzo accumulo"}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-slate-50"><tr><th className="px-3 py-2.5 text-left font-bold">Impianto</th>{battery.taglie.map((kwh) => <th key={kwh} className="px-3 py-2.5 text-right font-bold">{kwh} kWh</th>)}</tr></thead>
              <tbody>{Object.keys(battery.prezzi).sort((a, b) => Number(a) - Number(b)).map((kwp) => <tr key={kwp} className="border-t border-border">
                <td className="px-3 py-2 font-bold">{kwp} kWp</td>
                {battery.taglie.map((_, priceIndex) => <td key={priceIndex} className="px-3 py-2 text-right tabular-nums">{euro(battery.prezzi[kwp]?.[priceIndex])}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </section>)) : null}

        {vista === "accessori" ? (accessori.length === 0 ? <Empty>Nessun accessorio pubblicato.</Empty> : <section className="overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3 font-bold">Accessorio</th><th className="px-4 py-3 text-right font-bold">Prezzo</th><th className="px-4 py-3 text-right font-bold">In combo</th></tr></thead>
              <tbody>{accessori.map((item, index) => <tr key={index} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-foreground">{item.nome}</span>
                  {item.scontabile ? <Badge variant="outline" className="ml-2 border-teal-200 bg-teal-50 text-teal-800">Scontabile</Badge> : null}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{prezzoAccessorio(item.prezzo, item.unita)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{item.prezzo_combo == null ? "—" : prezzoAccessorio(item.prezzo_combo, item.unita)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>) : null}

        {vista === "offerte" ? (offerte.length === 0 ? <Empty>Nessuna offerta pubblicata disponibile.</Empty> : <ul className="space-y-3">{offerte.map((offer) => <li key={offer.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{offer.titolo}</p>
              {offer.descrizione ? <p className="mt-1 text-sm text-muted-foreground">{offer.descrizione}</p> : null}
            </div>
            <Badge className="shrink-0 bg-teal-600">Pubblicata</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{periodoOfferta(offer)}</span>
            {/* Stesso canale del PDF del listino: credenziali admin, quindi
                funziona anche per chi non ha un account Nextcloud collegato, e
                senza il vincolo di validita' del link pubblico — le date sono
                facoltative e nel sistema non fanno scadere nulla. */}
            {offer.pdf_path
              ? <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/offerta-commerciale/documenti?path=${encodeURIComponent(offer.pdf_path)}`} target="_blank" rel="noreferrer" />}><FileText className="size-4" />Apri PDF</Button>
              : <span className="text-xs font-medium text-muted-foreground">PDF non disponibile</span>}
          </div>
        </li>)}</ul>) : null}
      </div>
    </SheetContent>
  </Sheet>
}

export function OffertaCommercialeClient({
  initialData = null,
}: {
  initialData?: OffertaCommercialePayload | null
}) {
  // Con il precaricamento server-side il primo render ha già il contenuto:
  // niente spinner su schermo vuoto. Lo spinner resta solo per il caso in cui
  // il precaricamento non sia riuscito e i dati vadano chiesti dal client.
  const [data, setData] = useState<OffertaCommercialePayload | null>(initialData)
  const [catalogo, setCatalogo] = useState<CatalogoCommerciale | null>(
    initialData?.catalogo ?? null,
  )
  const [loading, setLoading] = useState(initialData == null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingCatalog, setDeletingCatalog] = useState<string | null>(null)
  const [publishingCatalog, setPublishingCatalog] = useState<string | null>(null)
  const [deletingDocument, setDeletingDocument] = useState<string | null>(null)
  // Sezioni schede prodotto: chiuse finche' non le si apre dai rispettivi
  // pulsanti sugli header delle tabelle prezzi.
  const [pannelliAperti, setPannelliAperti] = useState(false)
  const [batterieAperte, setBatterieAperte] = useState(false)
  // Tab controllata: un salvataggio bloccato deve poter portare l'utente sulla
  // riga che lo blocca, anche se sta guardando un'altra tab.
  const [tabCatalogo, setTabCatalogo] = useState("listino")
  const [mostraErroriAccessori, setMostraErroriAccessori] = useState(false)
  const [generatingPublicLink, setGeneratingPublicLink] = useState<string | null>(null)
  // Vista di sola lettura aperta da una card KPI: aperta a tutti, indipendente
  // dal pannello di gestione.
  const [vistaCatalogo, setVistaCatalogo] = useState<VistaCatalogo | null>(null)
  const permissions = usePermissions()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/offerta-commerciale", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Errore caricamento")
      setData(body)
      setCatalogo(body.catalogo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore caricamento")
    } finally { setLoading(false) }
  }, [])

  // Salta la fetch iniziale quando la pagina è arrivata già popolata dal
  // server; `load` resta per i refresh dopo salvataggi e sincronizzazioni.
  const hasInitialData = initialData != null
  useEffect(() => {
    if (hasInitialData) return
    void load()
  }, [hasInitialData, load])

  const saveCatalog = async () => {
    if (!catalogo) return
    // Blocca prima del PATCH le righe che il server scarterebbe in silenzio.
    const nonValidi = accessoriNonValidi(catalogo.accessori)
    if (nonValidi.length > 0) {
      setMostraErroriAccessori(true)
      setTabCatalogo("accessori")
      toast.error(nonValidi[0].messaggio)
      return
    }
    setMostraErroriAccessori(false)
    setSaving(true)
    try {
      const response = await fetch("/api/offerta-commerciale", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogo }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Salvataggio non riuscito")
      toast.success("Catalogo commerciale salvato")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore salvataggio") }
    finally { setSaving(false) }
  }

  const syncNextcloud = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/offerta-commerciale/sync", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Sincronizzazione non riuscita")
      const listini = body.published === 1 ? "1 listino pubblicato" : `${body.published ?? 0} listini pubblicati`
      toast.success(`Nextcloud sincronizzato: ${body.files} documenti, ${body.offerte} locandine, ${listini}`)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore sincronizzazione") }
    finally { setSyncing(false) }
  }

  const uploadFiles = async (category: CategoriaUpload, files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const caricati: string[] = []
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set("category", category)
        form.set("file", file)
        const response = await fetch("/api/offerta-commerciale/upload", { method: "POST", body: form })
        const body = await response.json()
        if (!response.ok) throw new Error(`${file.name}: ${body.error ?? "Upload non riuscito"}`)
        caricati.push(body.nome ?? file.name)
      }
      toast.success(`${caricati.length} file caricati: ${caricati.join(", ")}. Ora premi Sincronizza.`)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore upload") }
    finally { setUploading(false) }
  }

  const saveOffer = async (offer: OffertaPeriodo, successMessage = `Offerta ${offer.titolo} salvata`) => {
    try {
      const response = await fetch("/api/offerta-commerciale/offerte", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(offer) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Salvataggio offerta non riuscito")
      toast.success(successMessage)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore salvataggio") }
  }

  const generatePublicOfferLink = async (offer: OffertaPeriodo) => {
    if (!offer.pdf_path) {
      toast.error("Carica o sincronizza un PDF prima di generare il link pubblico")
      return
    }
    setGeneratingPublicLink(offer.id)
    try {
      const response = await fetch(`/api/offerta-commerciale/offerte/${offer.id}/public-link`, { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Generazione link pubblico non riuscita")
      const url = typeof body.url_pubblico === "string" ? body.url_pubblico : ""
      setData((current) => current ? {
        ...current,
        offerte: current.offerte.map((item) => item.id === offer.id ? { ...item, url_pubblico: url } : item),
      } : current)
      toast.success("Link pubblico Nextcloud generato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generazione link pubblico non riuscita")
    } finally {
      setGeneratingPublicLink(null)
    }
  }

  const deleteCatalog = async (id: string, name: string) => {
    if (!window.confirm(`Eliminare definitivamente il listino archiviato “${name}”?`)) return
    setDeletingCatalog(id)
    try {
      const response = await fetch(`/api/offerta-commerciale?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Eliminazione non riuscita")
      toast.success(body.sourceDeleted ? "Listino e PDF Nextcloud eliminati" : "Listino archiviato eliminato")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore eliminazione") }
    finally { setDeletingCatalog(null) }
  }

  const publishCatalog = async (id: string, name: string) => {
    if (!window.confirm(`Ripubblicare “${name}” come listino in uso? Il listino attualmente pubblicato verrà archiviato.`)) return
    setPublishingCatalog(id)
    try {
      const response = await fetch("/api/offerta-commerciale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "publish" }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Pubblicazione non riuscita")
      toast.success(`Listino “${name}” ripubblicato`)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore pubblicazione") }
    finally { setPublishingCatalog(null) }
  }

  const deleteDocument = async (path: string, name: string) => {
    if (!window.confirm(`Eliminare definitivamente “${name}” da Nextcloud?`)) return
    setDeletingDocument(path)
    try {
      const response = await fetch(`/api/offerta-commerciale/documenti?path=${encodeURIComponent(path)}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Eliminazione non riuscita")
      toast.success(body.cataloghi_eliminati > 0 ? "Documento e listini archiviati collegati eliminati" : "Documento eliminato da Nextcloud")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore eliminazione") }
    finally { setDeletingDocument(null) }
  }

  const publishedOffers = useMemo(() => data?.offerte.filter((offer) => offer.pubblicata) ?? [], [data])
  const activeOffers = publishedOffers.length
  // Doppio controllo: il payload e' la fonte autorevole (lo decide il server),
  // l'engine client evita che il pulsante compaia mentre la fetch e' in corso.
  const canManage = data?.canManage === true && permissions.canAction("offerta_commerciale.manage")

  if (loading && !data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>
  if (!catalogo || !data) return <Empty>Il modulo richiede la migrazione database “20260803_offerta_commerciale.sql”.</Empty>

  const setOffer = (id: string, patch: Partial<OffertaPeriodo>) => setData((current) => current ? { ...current, offerte: current.offerte.map((offer) => offer.id === id ? { ...offer, ...patch } : offer) } : current)
  const setDiscountCode = (index: number, patch: Partial<CodiceSconto>) => {
    const codici = [...(catalogo.codici_sconto ?? [])]
    codici[index] = { ...codici[index], ...patch }
    setCatalogo({ ...catalogo, codici_sconto: codici })
  }
  const toggleDiscountCodeField = async (index: number, patch: Partial<CodiceSconto>, successLabel: (code: CodiceSconto) => string) => {
    const codici = [...(catalogo.codici_sconto ?? [])]
    if (!codici[index]) return
    codici[index] = { ...codici[index], ...patch }
    const next = { ...catalogo, codici_sconto: codici }
    setCatalogo(next)
    try {
      const response = await fetch("/api/offerta-commerciale", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogo: next }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Salvataggio non riuscito")
      toast.success(successLabel(codici[index]))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio toggle")
    }
  }
  const toggleDiscountCodeAttivo = (index: number, attivo: boolean) =>
    toggleDiscountCodeField(index, { attivo }, (code) => attivo ? `Codice ${code.codice} attivato` : `Codice ${code.codice} disattivato`)
  const toggleDiscountCodeCumulabile = (index: number, cumulabile_con_sconto_zona: boolean) =>
    toggleDiscountCodeField(index, { cumulabile_con_sconto_zona }, (code) => cumulabile_con_sconto_zona ? `Codice ${code.codice}: ora cumulabile con sconto zona` : `Codice ${code.codice}: ora sostituisce lo sconto zona`)
  const addDiscountCode = () => setCatalogo({
    ...catalogo,
    codici_sconto: [
      ...(catalogo.codici_sconto ?? []),
      { codice: "NUOVO-CODICE", nome: "Nuovo codice sconto", descrizione: null, tipo: "percentuale", valore: 0, attivo: true, cumulabile_con_sconto_zona: false },
    ],
  })
  const removeDiscountCode = (index: number) => setCatalogo({
    ...catalogo,
    codici_sconto: (catalogo.codici_sconto ?? []).filter((_, itemIndex) => itemIndex !== index),
  })
  const setAccessorio = (index: number, patch: Partial<AccessorioCommerciale>) => {
    const accessori = [...catalogo.accessori]
    accessori[index] = { ...accessori[index], ...patch }
    setCatalogo({ ...catalogo, accessori })
  }
  const addAccessorio = () => setCatalogo({
    ...catalogo,
    accessori: [
      ...catalogo.accessori,
      { nome: "Nuovo accessorio", prezzo: 0, prezzo_combo: null, unita: "€", scontabile: false },
    ],
  })
  const removeAccessorio = (index: number) => setCatalogo({
    ...catalogo,
    accessori: catalogo.accessori.filter((_, itemIndex) => itemIndex !== index),
  })
  // Ricalcolati a ogni render: l'evidenziazione sparisce appena si corregge.
  const erroriAccessori = mostraErroriAccessori ? accessoriNonValidi(catalogo.accessori) : []
  const erroreAccessorio = (index: number) => erroriAccessori.find((e) => e.index === index)
  const pannelli = catalogo.specifiche_prodotto?.pannelli ?? []
  const setPannelli = (next: PannelloSpec[]) => setCatalogo({
    ...catalogo,
    specifiche_prodotto: { ...(catalogo.specifiche_prodotto ?? {}), pannelli: next },
  })
  // Voci pubblicate al configuratore: normalizeAccessori scarta lato server le
  // righe senza nome o con prezzo negativo, quindi il conteggio le esclude.
  const accessoriAttivi = catalogo.accessori.filter((item) => item.nome.trim() && item.prezzo >= 0).length
  const visibleOffers = canManage ? data.offerte : data.offerte.filter((offer) => offer.pubblicata)
  const validitaListino = [
    catalogo.valido_dal ? `dal ${new Date(catalogo.valido_dal).toLocaleDateString("it-IT")}` : null,
    catalogo.valido_al ? `al ${new Date(catalogo.valido_al).toLocaleDateString("it-IT")}` : null,
  ].filter(Boolean).join(" ") || "validità non indicata"

  return <div className="flex flex-col gap-6">
    <header className="offerta-hero">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-700 text-white">Area commerciale</Badge>
            <Badge variant="outline" className="bg-white text-blue-700">Listino attivo</Badge>
            {!canManage ? <Badge variant="secondary"><ShieldCheck className="size-3.5" />Sola lettura</Badge> : null}
          </div>
          <h1 className="offerta-hero-title">Offerta Commerciale</h1>
          <p className="offerta-hero-subtitle">Prepara una stima commerciale partendo dal listino pubblicato e dalle offerte del periodo.</p>
        </div>
        {canManage ? <Sheet>
          <SheetTrigger render={<Button className="bg-blue-700 text-white hover:bg-blue-800" />}>
            <Settings2 className="size-4" />Gestione catalogo
          </SheetTrigger>
          <SheetContent className="max-w-none overflow-y-auto bg-slate-50 p-0 data-[side=right]:!w-[92vw] sm:!max-w-[1180px] xl:data-[side=right]:!w-[1180px]" showCloseButton>
            <SheetHeader className="border-b bg-white px-6 py-5">
              <SheetTitle className="flex items-center gap-2 text-xl"><Settings2 className="size-5 text-blue-700" />Gestione catalogo commerciale</SheetTitle>
              <SheetDescription>Strumenti riservati agli utenti con permesso di gestione: listini, regole, offerte e documenti.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 p-6">
              <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Listino corrente</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-[1fr_170px_170px]">
                      <Input value={catalogo.nome} onChange={(event) => setCatalogo({ ...catalogo, nome: event.target.value })} aria-label="Nome listino" />
                      <Input type="date" value={catalogo.valido_dal ?? ""} onChange={(event) => setCatalogo({ ...catalogo, valido_dal: event.target.value || null })} aria-label="Valido dal" />
                      <Input type="date" value={catalogo.valido_al ?? ""} onChange={(event) => setCatalogo({ ...catalogo, valido_al: event.target.value || null })} aria-label="Valido al" />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Fonte: {data.nextcloudRoot} · Stato: {catalogo.stato} · Pubblicazione automatica dei nuovi listini validi</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" nativeButton={false} render={<label className="cursor-pointer" />} disabled={uploading}>
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Carica listino
                      <input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={(e) => { void uploadFiles("listini", e.target.files); e.target.value="" }} />
                    </Button>
                    <Button variant="outline" onClick={syncNextcloud} disabled={syncing || uploading}>{syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Sincronizza</Button>
                    <Button onClick={saveCatalog} disabled={saving} className="bg-teal-600 hover:bg-teal-700">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salva</Button>
                  </div>
                </div>
              </section>

              <Tabs value={tabCatalogo} onValueChange={(value) => setTabCatalogo(String(value))}>
                <TabsList variant="line" className="w-full justify-start overflow-visible border-b border-border">
                  <TabsTrigger value="listino" className="h-11 text-base font-bold data-active:text-blue-700 data-active:after:bg-blue-700"><BookOpenCheck className="size-4 text-blue-600" />Listino solo FV</TabsTrigger>
                  <TabsTrigger value="accumulo" className="h-11 text-base font-bold data-active:text-amber-700 data-active:after:bg-amber-500"><BatteryCharging className="size-4 text-amber-600" />Batterie</TabsTrigger>
                  <TabsTrigger value="accessori" className="h-11 text-base font-bold data-active:text-teal-700 data-active:after:bg-teal-600"><Plug className="size-4 text-teal-600" />Accessori</TabsTrigger>
                  <TabsTrigger value="regole" className="h-11 text-base font-bold data-active:text-amber-700 data-active:after:bg-amber-500"><SlidersHorizontal className="size-4 text-amber-600" />Regole</TabsTrigger>
                  <TabsTrigger value="offerte-admin" className="h-11 text-base font-bold data-active:text-teal-700 data-active:after:bg-teal-600"><PackageOpen className="size-4 text-teal-600" />Offerte</TabsTrigger>
                  <TabsTrigger value="documenti-admin" className="h-11 text-base font-bold data-active:text-indigo-700 data-active:after:bg-indigo-600"><Cloud className="size-4 text-indigo-600" />Documenti</TabsTrigger>
                  <TabsTrigger value="roberta-admin" className="h-11 text-base font-bold data-active:text-violet-700 data-active:after:bg-violet-600"><Bot className="size-4 text-violet-600" />RobertaBot</TabsTrigger>
                </TabsList>

                <TabsContent value="listino" className="space-y-5 pt-5">
                  <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/60 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-bold text-blue-950">Prezzo Impianto FV (Senza Accumulo)</h2><p className="text-sm font-medium text-blue-700/80">Prezzi IVA inclusa per taglia nominale.</p></div><ToggleSezione aperta={pannelliAperti} onToggle={() => setPannelliAperti((v) => !v)} tone="blue">Pannelli Disponibili</ToggleSezione></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3 text-base font-bold">Potenza</th><th className="px-4 py-3 text-base font-bold">Prezzo</th></tr></thead><tbody>{catalogo.fotovoltaico.map((row, index) => <tr key={index} className="border-t border-border"><td className="px-4 py-2"><Input className="max-w-28 font-semibold" type="number" value={row.kwp} onChange={(e) => { const next = [...catalogo.fotovoltaico]; next[index] = { ...row, kwp: numberValue(e.target.value) }; setCatalogo({ ...catalogo, fotovoltaico: next }) }} /></td><td className="px-4 py-2"><Input className="max-w-40 font-semibold" type="number" value={row.prezzo} onChange={(e) => { const next = [...catalogo.fotovoltaico]; next[index] = { ...row, prezzo: numberValue(e.target.value) }; setCatalogo({ ...catalogo, fotovoltaico: next }) }} /></td></tr>)}</tbody></table></div></section>
                  {pannelliAperti ? <PannelliSection pannelli={pannelli} onChange={setPannelli} onClose={() => setPannelliAperti(false)} /> : null}
                </TabsContent>

                <TabsContent value="accumulo" className="space-y-5 pt-5">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-5 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200"><BatteryCharging className="size-5" /></span><div><h2 className="text-xl font-bold text-amber-950">Prezzi accumulo per taglia di impianto</h2><p className="mt-1 text-sm font-medium text-amber-800/80">Ogni tabella mostra il sovrapprezzo accumulo in base ai kWp dell&apos;impianto fotovoltaico.</p></div></div><ToggleSezione aperta={batterieAperte} onToggle={() => setBatterieAperte((v) => !v)} tone="amber">Batterie Disponibili</ToggleSezione></div></div>
                  <TesterPrezzoAccumulo catalogo={catalogo} />
                  {batterieAperte ? <BatterieSection onClose={() => setBatterieAperte(false)} documenti={documenti} marche={catalogo.accumuli.map((m) => m.marca)} /> : null}
                  {catalogo.accumuli.map((battery, batteryIndex) => <section key={battery.marca} className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 p-4"><div><h2 className="text-lg font-bold text-amber-950">{battery.marca}</h2><p className="text-sm font-medium text-amber-800/80">{battery.tensione ? `${battery.tensione} tensione` : ""} {battery.ip ? `· ${battery.ip}` : ""} {battery.garanzia_anni ? `· ${battery.garanzia_anni} anni` : ""}</p></div><Badge variant="outline" className="border-amber-200 bg-white text-amber-800">Sovrapprezzo accumulo</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 text-left text-base font-bold">Taglia impianto</th>{battery.taglie.map((kwh) => <th key={kwh} className="px-3 py-3 text-right text-base font-bold">{kwh} kWh</th>)}</tr></thead><tbody>{Object.keys(battery.prezzi).sort((a,b) => Number(a)-Number(b)).map((kwp) => <tr key={kwp} className="border-t border-border"><td className="px-3 py-2 font-bold">{kwp} kWp</td>{battery.taglie.map((_, priceIndex) => <td key={priceIndex} className="px-3 py-2 text-right"><Input className="ml-auto w-28 text-right font-semibold" type="number" value={battery.prezzi[kwp]?.[priceIndex] ?? 0} onChange={(e) => { const accumuli = structuredClone(catalogo.accumuli); accumuli[batteryIndex].prezzi[kwp][priceIndex] = numberValue(e.target.value); setCatalogo({ ...catalogo, accumuli }) }} /></td>)}</tr>)}</tbody></table></div></section>)}
                </TabsContent>

                <TabsContent value="accessori" className="space-y-5 pt-5">
                  <section className="overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-teal-100 bg-teal-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-white text-teal-700 ring-1 ring-teal-200"><Plug className="size-5" /></span>
                        <div>
                          <h2 className="text-lg font-bold text-teal-950">Accessori</h2>
                          <p className="mt-1 text-sm font-medium text-teal-800/80">Wallbox, ottimizzatori e servizi aggiuntivi. Le modifiche si applicano con “Salva”.</p>
                        </div>
                      </div>
                      <Button type="button" onClick={addAccessorio} className="bg-teal-600 text-white hover:bg-teal-700"><Plus className="size-4" />Aggiungi accessorio</Button>
                    </div>
                    {catalogo.accessori.length === 0 ? <div className="p-4"><Empty>Nessun accessorio configurato.</Empty></div> : <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead className="bg-slate-50 text-left">
                          <tr>
                            <th className="px-4 py-3 text-base font-bold">Accessorio</th>
                            <th className="px-4 py-3 text-base font-bold">Prezzo</th>
                            <th className="px-4 py-3 text-base font-bold">Prezzo combo</th>
                            <th className="px-4 py-3 text-base font-bold">Unità</th>
                            <th className="px-4 py-3 text-base font-bold">Scontabile</th>
                            <th className="w-14 px-3 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {catalogo.accessori.map((item, index) => { const errore = erroreAccessorio(index); return <tr key={index} className={`border-t border-border ${errore ? "bg-destructive/5" : ""}`}>
                            <td className="px-4 py-2"><Input className="font-semibold" aria-invalid={errore?.campo === "nome"} value={item.nome} onChange={(e) => setAccessorio(index, { nome: e.target.value })} /></td>
                            <td className="px-4 py-2"><Input className="w-32 font-semibold" type="number" aria-invalid={errore?.campo === "prezzo"} value={item.prezzo} onChange={(e) => setAccessorio(index, { prezzo: numberValue(e.target.value) })} /></td>
                            <td className="px-4 py-2"><Input className="w-32 font-semibold" type="number" placeholder="—" value={item.prezzo_combo ?? ""} onChange={(e) => setAccessorio(index, { prezzo_combo: e.target.value === "" ? null : numberValue(e.target.value) })} /></td>
                            <td className="px-4 py-2"><Input className="w-24 font-semibold" value={item.unita} onChange={(e) => setAccessorio(index, { unita: e.target.value })} /></td>
                            <td className="px-4 py-2"><Switch checked={item.scontabile} onCheckedChange={(checked) => setAccessorio(index, { scontabile: checked })} /></td>
                            <td className="px-3 py-2 text-right"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Elimina ${item.nome}`} onClick={() => removeAccessorio(index)}><Trash2 className="size-4 text-destructive" /></Button></td>
                          </tr> })}
                        </tbody>
                      </table>
                    </div>}
                    {erroriAccessori.length > 0 ? <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3">
                      {erroriAccessori.map((errore) => <p key={`${errore.index}-${errore.campo}`} className="text-sm font-medium text-destructive">Riga {errore.index + 1}: {errore.messaggio}</p>)}
                    </div> : null}
                  </section>
                </TabsContent>

                <TabsContent value="regole" className="space-y-5 pt-5"><p className="text-sm font-medium text-muted-foreground">Regole generate automaticamente dal listino in sincronizzazione. Non sono modificabili manualmente: un edit qui verrebbe comunque sovrascritto al prossimo sync di un nuovo listino.</p><div className="grid gap-4 lg:grid-cols-3">{catalogo.sconti.map((rule,index) => <article key={index} className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Zona {rule.zona}</h3><Badge className="bg-blue-700">{rule.percentuale}%</Badge></div><div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Da kWp<Input type="number" value={rule.kwp_min} disabled readOnly /></label><label className="text-xs text-muted-foreground">A kWp<Input type="number" value={rule.kwp_max} disabled readOnly /></label><label className="text-xs text-muted-foreground">Sconto %<Input type="number" value={rule.percentuale} disabled readOnly /></label><label className="text-xs text-muted-foreground">EPS<Input type="number" value={rule.eps_prezzo} disabled readOnly /></label></div><label className="mt-4 flex items-center justify-between text-sm">EPS omaggiabile<Switch checked={rule.eps_omaggiabile} disabled /></label></article>)}</div><section className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/60 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200"><TicketPercent className="size-5" /></span><div><h2 className="text-lg font-bold text-amber-950">Codici sconto</h2><p className="text-sm font-medium text-amber-800/80">Archivio dei codici sconto. Il toggle Attivo e Cumulabile con sconto zona si salvano subito; gli altri campi richiedono &quot;Salva&quot;.</p></div></div><Button type="button" onClick={addDiscountCode} className="bg-amber-600 text-white hover:bg-amber-700"><Plus className="size-4" />Aggiungi codice</Button></div>{(catalogo.codici_sconto ?? []).length === 0 ? <Empty>Nessun codice sconto configurato.</Empty> : <div className="space-y-3 p-4">{(catalogo.codici_sconto ?? []).map((code, index) => <article key={index} className="rounded-xl border border-amber-100 bg-amber-50/30 p-4"><div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)_150px_130px_90px_170px_40px]"><label className="text-xs font-medium text-muted-foreground">Codice<Input className="mt-1 font-bold uppercase" value={code.codice} onChange={(e) => setDiscountCode(index, { codice: e.target.value })} /></label><label className="text-xs font-medium text-muted-foreground">Nome<Input className="mt-1 font-semibold" value={code.nome} onChange={(e) => setDiscountCode(index, { nome: e.target.value })} /></label><label className="text-xs font-medium text-muted-foreground">Tipo<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground" value={code.tipo} onChange={(e) => setDiscountCode(index, { tipo: e.target.value as CodiceSconto["tipo"] })}><option value="percentuale">Percentuale</option><option value="importo">Importo</option><option value="omaggio">Omaggio</option><option value="nota">Nota</option></select></label><label className="text-xs font-medium text-muted-foreground">Valore<Input className="mt-1 font-semibold" type="number" value={code.valore ?? 0} onChange={(e) => setDiscountCode(index, { valore: numberValue(e.target.value) })} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-medium">Attivo<Switch checked={code.attivo} onCheckedChange={(checked) => void toggleDiscountCodeAttivo(index, checked)} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs font-medium leading-tight" title="Attivo: la percentuale del codice si somma allo sconto di zona. Spento: lo sostituisce.">Cumulabile con sconto zona<Switch checked={code.cumulabile_con_sconto_zona === true} onCheckedChange={(checked) => void toggleDiscountCodeCumulabile(index, checked)} /></label><Button type="button" variant="ghost" size="icon-sm" aria-label={`Rimuovi ${code.codice}`} onClick={() => removeDiscountCode(index)}><Trash2 className="size-4 text-destructive" /></Button></div><Textarea className="mt-3 bg-white" value={code.descrizione ?? ""} onChange={(e) => setDiscountCode(index, { descrizione: e.target.value })} placeholder="Descrivi cosa comporta il codice: es. sconto extra, accessorio incluso, promo limitata, vincoli di applicazione..." /></article>)}</div>}</section><Textarea className="bg-white" value={catalogo.note ?? ""} onChange={(e) => setCatalogo({...catalogo,note:e.target.value})} placeholder="Note e condizioni commerciali" /></TabsContent>

                <TabsContent value="offerte-admin" className="pt-5">{data.offerte.length === 0 ? <Empty>Carica PDF e copertine nelle offerte del periodo, poi avvia la sincronizzazione.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{data.offerte.map((offer) => <OffertaAdminCard key={offer.id} offer={offer} generatingPublicLink={generatingPublicLink === offer.id} onPatch={(patch) => setOffer(offer.id, patch)} onSave={() => saveOffer(offer)} onGeneratePublicLink={() => void generatePublicOfferLink(offer)} />)}</div>}</TabsContent>

                <TabsContent value="documenti-admin" className="space-y-5 pt-5">
                  <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <PanelTitle icon={Upload} title="Carica documenti" description="Carica i file su Nextcloud, poi usa Sincronizza per importarli nel CRM. Massimo 25 MB per file." />
                      <Button variant="outline" onClick={syncNextcloud} disabled={syncing || uploading}>{syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Sincronizza ora</Button>
                    </div>
                    {uploading ? <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800"><Loader2 className="size-4 animate-spin" />Upload in corso su Nextcloud</div> : null}
                    <div className="grid gap-3 md:grid-cols-4">
                      {UPLOAD_CATEGORIES.map((config) => <UploadTile key={config.key} config={config} uploading={uploading} onUpload={(category, files) => void uploadFiles(category, files)} />)}
                    </div>
                  </section>

                  <StoricoListini versioni={data.versioni} catalogoId={catalogo.id} deletingCatalog={deletingCatalog} publishingCatalog={publishingCatalog} onDelete={(id, name) => void deleteCatalog(id, name)} onPublish={(id, name) => void publishCatalog(id, name)} />
                  <DocumentiNextcloud documenti={data.documenti} fonteAttiva={catalogo.fonte_path} deletingDocument={deletingDocument} onDelete={(path, name) => void deleteDocument(path, name)} />
                </TabsContent>

                <TabsContent value="roberta-admin" className="space-y-5 pt-5">
                  <RobertaSourcesPanel />
                </TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet> : <Badge variant="secondary" className="w-fit"><ShieldCheck className="size-3.5" />Permesso agente</Badge>}
      </div>
    </header>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {/* Il PDF del listino e' il file sincronizzato da Nextcloud: senza
          fonte_path la card resta informativa. */}
      <Metric icon={BookOpenCheck} label="Listino" value={catalogo.nome} hint="listino attivo" tone="navy" kind="text" azione={catalogo.fonte_path ? "Apri PDF" : undefined} href={catalogo.fonte_path ? `/api/offerta-commerciale/documenti?path=${encodeURIComponent(catalogo.fonte_path)}` : undefined} />
      <Metric icon={SolarPanel} label="Taglie FV" value={String(catalogo.fotovoltaico.length)} hint="taglie a listino" tone="blue" azione="Vedi" onClick={() => setVistaCatalogo("fv")} />
      <Metric icon={BatteryCharging} label="Accumuli" value={String(catalogo.accumuli.length)} hint="marche in catalogo" tone="amber" azione="Vedi" onClick={() => setVistaCatalogo("accumuli")} />
      <Metric icon={Plug} label="Accessori" value={String(accessoriAttivi)} hint="voci pubblicate" tone="teal" azione="Vedi" onClick={() => setVistaCatalogo("accessori")} />
      <Metric icon={PackageOpen} label="Offerte" value={String(activeOffers)} hint="offerte del periodo" tone="slate" azione="Vedi" onClick={() => setVistaCatalogo("offerte")} />
    </div>

    <VistaCatalogoSheet vista={vistaCatalogo} onChiudi={() => setVistaCatalogo(null)} catalogo={catalogo} offerte={publishedOffers} documenti={data.documenti} />

    <section className="offerta-panel px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="offerta-panel-icon"><BookOpenCheck className="size-5" /></span>
          <div>
            <p className="text-[0.9375rem] font-extrabold tracking-tight text-slate-950">{catalogo.nome}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{validitaListino} · stato {catalogo.stato}</p>
          </div>
        </div>
        <Badge className="bg-teal-600 text-white"><ShieldCheck className="size-3.5" />Listino in uso</Badge>
      </div>
    </section>

    <Tabs defaultValue="calcolo">
      <TabsList variant="line" className="w-full justify-start overflow-visible border-b border-border">
        <TabsTrigger value="calcolo"><Calculator className="size-4" />Calcolo offerta</TabsTrigger>
        <TabsTrigger value="offerte"><PackageOpen className="size-4" />Offerte del periodo</TabsTrigger>
      </TabsList>

      <TabsContent value="calcolo" className="pt-5"><SezioneCliente /></TabsContent>

      <TabsContent value="offerte" className="pt-5">{visibleOffers.length === 0 ? <Empty>Nessuna offerta pubblicata disponibile.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{visibleOffers.map((offer) => <article key={offer.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">{offer.cover_path ? <img src={`/api/offerta-commerciale/offerte/${offer.id}/asset?kind=cover`} alt="" className="h-52 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-slate-100"><FileText className="size-10 text-muted-foreground" /></div>}<div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{offer.titolo}</h2>{offer.descrizione ? <p className="mt-2 text-sm text-muted-foreground">{offer.descrizione}</p> : null}</div>{offer.pubblicata ? <Badge className="bg-teal-600">Pubblicata</Badge> : <Badge variant="outline">Bozza</Badge>}</div>{canManage ? <Badge variant={offer.testo_estratto ? "secondary" : "outline"}>{offer.testo_estratto ? `${offer.testo_estratto.length.toLocaleString("it-IT")} caratteri letti` : "solo PDF"}</Badge> : null}<div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground"><span>{offer.valido_dal ? new Date(offer.valido_dal).toLocaleDateString("it-IT") : "Data inizio libera"} - {offer.valido_al ? new Date(offer.valido_al).toLocaleDateString("it-IT") : "senza scadenza"}</span><div className="flex flex-wrap items-center gap-2">{offer.pdf_path ? <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/offerta-commerciale/offerte/${offer.id}/asset`} target="_blank" rel="noreferrer" />}>Apri PDF</Button> : null}{offer.pdf_path && offer.pubblicata ? <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/public/offerte-periodo/${offer.id}/pdf`} target="_blank" rel="noreferrer" />}>Link pubblico</Button> : null}</div></div>{canManage ? <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Switch checked={offer.pubblicata} onCheckedChange={(checked) => { const updated = { ...offer, pubblicata: checked }; setOffer(offer.id, { pubblicata: checked }); void saveOffer(updated, checked ? "RobertaBot puo usare questo PDF" : "PDF nascosto a RobertaBot") }} />RobertaBot</label> : null}</div></article>)}</div>}</TabsContent>
    </Tabs>
  </div>
}
