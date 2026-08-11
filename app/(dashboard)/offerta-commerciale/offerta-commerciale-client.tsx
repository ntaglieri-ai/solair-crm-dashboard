"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Archive, BadgeEuro, BatteryCharging, BookOpenCheck, Calculator, Cloud, FileText, Loader2, PackageOpen, Plus, RefreshCw, Save, Settings2, ShieldCheck, SlidersHorizontal, SolarPanel, TicketPercent, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { CatalogoCommerciale, CodiceSconto, OffertaCommercialePayload, OffertaPeriodo } from "@/lib/offerta-commerciale/types"

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function Metric({ icon: Icon, label, value, tone = "blue" }: { icon: typeof BadgeEuro; label: string; value: string; tone?: "blue" | "teal" | "amber" | "slate" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-50 text-slate-700 ring-slate-100",
  }
  return <div className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className={`flex size-9 items-center justify-center rounded-lg ring-1 ${tones[tone]}`}><Icon className="size-4" /></span><div><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold text-foreground">{value}</div></div></div></div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{children}</div>
}

function PanelTitle({ icon: Icon, title, description }: { icon: typeof BadgeEuro; title: string; description?: string }) {
  return <div className="mb-4 flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Icon className="size-4" /></span><div><h2 className="font-semibold text-foreground">{title}</h2>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div></div>
}

export function OffertaCommercialeClient() {
  const [data, setData] = useState<OffertaCommercialePayload | null>(null)
  const [catalogo, setCatalogo] = useState<CatalogoCommerciale | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingCatalog, setDeletingCatalog] = useState<string | null>(null)
  const [deletingDocument, setDeletingDocument] = useState<string | null>(null)
  const [quoteKwp, setQuoteKwp] = useState(6)
  const [quoteBrand, setQuoteBrand] = useState("Sineng")
  const [quoteKwh, setQuoteKwh] = useState(10.6)
  const [quoteZone, setQuoteZone] = useState("A")
  const [quoteEps, setQuoteEps] = useState(false)
  const [quoteEpsGift, setQuoteEpsGift] = useState(false)

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

  useEffect(() => { void load() }, [load])

  const saveCatalog = async () => {
    if (!catalogo) return
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

  const uploadFiles = async (category: "listini" | "offerte" | "schede", files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set("category", category)
        form.set("file", file)
        const response = await fetch("/api/offerta-commerciale/upload", { method: "POST", body: form })
        const body = await response.json()
        if (!response.ok) throw new Error(`${file.name}: ${body.error ?? "Upload non riuscito"}`)
      }
      toast.success(`${files.length} file caricati su Nextcloud`)
      await syncNextcloud()
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

  const deleteDocument = async (path: string, name: string) => {
    if (!window.confirm(`Eliminare definitivamente “${name}” da Nextcloud?`)) return
    setDeletingDocument(path)
    try {
      const response = await fetch(`/api/offerta-commerciale/documenti?path=${encodeURIComponent(path)}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Eliminazione non riuscita")
      toast.success("Documento eliminato da Nextcloud")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore eliminazione") }
    finally { setDeletingDocument(null) }
  }

  const activeOffers = useMemo(() => data?.offerte.filter((offer) => offer.pubblicata).length ?? 0, [data])
  const canManage = data?.canManage === true

  if (loading && !data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>
  if (!catalogo || !data) return <Empty>Il modulo richiede la migrazione database “20260803_offerta_commerciale.sql”.</Empty>

  const setOffer = (id: string, patch: Partial<OffertaPeriodo>) => setData((current) => current ? { ...current, offerte: current.offerte.map((offer) => offer.id === id ? { ...offer, ...patch } : offer) } : current)
  const setDiscountCode = (index: number, patch: Partial<CodiceSconto>) => {
    const codici = [...(catalogo.codici_sconto ?? [])]
    codici[index] = { ...codici[index], ...patch }
    setCatalogo({ ...catalogo, codici_sconto: codici })
  }
  const addDiscountCode = () => setCatalogo({
    ...catalogo,
    codici_sconto: [
      ...(catalogo.codici_sconto ?? []),
      { codice: "NUOVO-CODICE", nome: "Nuovo codice sconto", descrizione: null, tipo: "percentuale", valore: 0, attivo: true },
    ],
  })
  const removeDiscountCode = (index: number) => setCatalogo({
    ...catalogo,
    codici_sconto: (catalogo.codici_sconto ?? []).filter((_, itemIndex) => itemIndex !== index),
  })
  const quoteBattery = catalogo.accumuli.find((item) => item.marca === quoteBrand) ?? catalogo.accumuli[0]
  const quoteCapacityIndex = quoteBattery?.taglie.indexOf(quoteKwh) ?? -1
  const quoteBase = catalogo.fotovoltaico.find((item) => item.kwp === quoteKwp)?.prezzo ?? null
  const quoteStorage = quoteBattery && quoteCapacityIndex >= 0 ? quoteBattery.prezzi[String(quoteKwp)]?.[quoteCapacityIndex] ?? null : null
  const quoteRule = catalogo.sconti.find((rule) => rule.zona === quoteZone && quoteKwp >= rule.kwp_min && quoteKwp <= rule.kwp_max)
  const quoteSubtotal = quoteBase != null && quoteStorage != null ? quoteBase + quoteStorage : null
  const quoteDiscount = quoteSubtotal != null && quoteRule ? quoteSubtotal * quoteRule.percentuale / 100 : 0
  const quoteEpsPrice = quoteEps && !(quoteEpsGift && quoteRule?.eps_omaggiabile) ? quoteRule?.eps_prezzo ?? 0 : 0
  const quoteTotal = quoteSubtotal != null ? quoteSubtotal - quoteDiscount + quoteEpsPrice : null
  const visibleOffers = canManage ? data.offerte : data.offerte.filter((offer) => offer.pubblicata)
  const validitaListino = [
    catalogo.valido_dal ? `dal ${new Date(catalogo.valido_dal).toLocaleDateString("it-IT")}` : null,
    catalogo.valido_al ? `al ${new Date(catalogo.valido_al).toLocaleDateString("it-IT")}` : null,
  ].filter(Boolean).join(" ") || "validità non indicata"

  return <div className="flex flex-col gap-6">
    <header className="overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-700 text-white">Area commerciale</Badge>
            <Badge variant="outline" className="bg-white text-blue-700">Listino attivo</Badge>
            {!canManage ? <Badge variant="secondary"><ShieldCheck className="size-3.5" />Sola lettura</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Offerta Commerciale</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Prepara una stima commerciale partendo dal listino pubblicato e dalle offerte del periodo.</p>
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
                    <Button variant="outline" onClick={syncNextcloud} disabled={syncing}>{syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Sincronizza</Button>
                    <Button onClick={saveCatalog} disabled={saving} className="bg-teal-600 hover:bg-teal-700">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salva</Button>
                  </div>
                </div>
              </section>

              <Tabs defaultValue="listino">
                <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b border-border">
                  <TabsTrigger value="listino" className="h-11 text-base font-bold data-active:text-blue-700 data-active:after:bg-blue-700"><BookOpenCheck className="size-4 text-blue-600" />Listino</TabsTrigger>
                  <TabsTrigger value="regole" className="h-11 text-base font-bold data-active:text-amber-700 data-active:after:bg-amber-500"><SlidersHorizontal className="size-4 text-amber-600" />Regole</TabsTrigger>
                  <TabsTrigger value="offerte-admin" className="h-11 text-base font-bold data-active:text-teal-700 data-active:after:bg-teal-600"><PackageOpen className="size-4 text-teal-600" />Offerte</TabsTrigger>
                  <TabsTrigger value="documenti-admin" className="h-11 text-base font-bold data-active:text-indigo-700 data-active:after:bg-indigo-600"><Cloud className="size-4 text-indigo-600" />Documenti</TabsTrigger>
                </TabsList>

                <TabsContent value="listino" className="space-y-5 pt-5">
                  <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm"><div className="border-b border-blue-100 bg-blue-50/60 p-4"><h2 className="text-lg font-bold text-blue-950">Fotovoltaico senza accumulo</h2><p className="text-sm font-medium text-blue-700/80">Prezzi IVA inclusa per taglia nominale.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3 text-base font-bold">Potenza</th><th className="px-4 py-3 text-base font-bold">Prezzo</th></tr></thead><tbody>{catalogo.fotovoltaico.map((row, index) => <tr key={index} className="border-t border-border"><td className="px-4 py-2"><Input className="max-w-28 font-semibold" type="number" value={row.kwp} onChange={(e) => { const next = [...catalogo.fotovoltaico]; next[index] = { ...row, kwp: numberValue(e.target.value) }; setCatalogo({ ...catalogo, fotovoltaico: next }) }} /></td><td className="px-4 py-2"><Input className="max-w-40 font-semibold" type="number" value={row.prezzo} onChange={(e) => { const next = [...catalogo.fotovoltaico]; next[index] = { ...row, prezzo: numberValue(e.target.value) }; setCatalogo({ ...catalogo, fotovoltaico: next }) }} /></td></tr>)}</tbody></table></div></section>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200"><BatteryCharging className="size-5" /></span><div><h2 className="text-xl font-bold text-amber-950">Prezzi accumulo per taglia di impianto</h2><p className="mt-1 text-sm font-medium text-amber-800/80">Ogni tabella mostra il sovrapprezzo accumulo in base ai kWp dell&apos;impianto fotovoltaico.</p></div></div></div>
                  {catalogo.accumuli.map((battery, batteryIndex) => <section key={battery.marca} className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 p-4"><div><h2 className="text-lg font-bold text-amber-950">{battery.marca}</h2><p className="text-sm font-medium text-amber-800/80">{battery.tensione ? `${battery.tensione} tensione` : ""} {battery.ip ? `· ${battery.ip}` : ""} {battery.garanzia_anni ? `· ${battery.garanzia_anni} anni` : ""}</p></div><Badge variant="outline" className="border-amber-200 bg-white text-amber-800">Sovrapprezzo accumulo</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 text-left text-base font-bold">Taglia impianto</th>{battery.taglie.map((kwh) => <th key={kwh} className="px-3 py-3 text-right text-base font-bold">{kwh} kWh</th>)}</tr></thead><tbody>{Object.keys(battery.prezzi).sort((a,b) => Number(a)-Number(b)).map((kwp) => <tr key={kwp} className="border-t border-border"><td className="px-3 py-2 font-bold">{kwp} kWp</td>{battery.taglie.map((_, priceIndex) => <td key={priceIndex} className="px-3 py-2 text-right"><Input className="ml-auto w-28 text-right font-semibold" type="number" value={battery.prezzi[kwp]?.[priceIndex] ?? 0} onChange={(e) => { const accumuli = structuredClone(catalogo.accumuli); accumuli[batteryIndex].prezzi[kwp][priceIndex] = numberValue(e.target.value); setCatalogo({ ...catalogo, accumuli }) }} /></td>)}</tr>)}</tbody></table></div></section>)}
                  <section className="overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm"><div className="border-b border-teal-100 bg-teal-50/60 p-4"><h2 className="text-lg font-bold text-teal-950">Accessori</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3 text-base font-bold">Accessorio</th><th className="px-4 py-3 text-base font-bold">Prezzo</th><th className="px-4 py-3 text-base font-bold">Unità</th><th className="px-4 py-3 text-base font-bold">Scontabile</th></tr></thead><tbody>{catalogo.accessori.map((item,index) => <tr key={index} className="border-t border-border"><td className="px-4 py-2"><Input className="font-semibold" value={item.nome} onChange={(e) => { const next=[...catalogo.accessori]; next[index]={...item,nome:e.target.value}; setCatalogo({...catalogo,accessori:next}) }} /></td><td className="px-4 py-2"><Input className="w-32 font-semibold" type="number" value={item.prezzo} onChange={(e) => { const next=[...catalogo.accessori]; next[index]={...item,prezzo:numberValue(e.target.value)}; setCatalogo({...catalogo,accessori:next}) }} /></td><td className="px-4 py-2 font-semibold">{item.unita}</td><td className="px-4 py-2"><Switch checked={item.scontabile} onCheckedChange={(checked) => { const next=[...catalogo.accessori]; next[index]={...item,scontabile:checked}; setCatalogo({...catalogo,accessori:next}) }} /></td></tr>)}</tbody></table></div></section>
                </TabsContent>

                <TabsContent value="regole" className="space-y-5 pt-5"><div className="grid gap-4 lg:grid-cols-3">{catalogo.sconti.map((rule,index) => <article key={index} className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Zona {rule.zona}</h3><Badge className="bg-blue-700">{rule.percentuale}%</Badge></div><div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Da kWp<Input type="number" value={rule.kwp_min} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,kwp_min:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label><label className="text-xs text-muted-foreground">A kWp<Input type="number" value={rule.kwp_max} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,kwp_max:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label><label className="text-xs text-muted-foreground">Sconto %<Input type="number" value={rule.percentuale} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,percentuale:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label><label className="text-xs text-muted-foreground">EPS<Input type="number" value={rule.eps_prezzo} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,eps_prezzo:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label></div><label className="mt-4 flex items-center justify-between text-sm">EPS omaggiabile<Switch checked={rule.eps_omaggiabile} onCheckedChange={(checked) => { const next=[...catalogo.sconti]; next[index]={...rule,eps_omaggiabile:checked}; setCatalogo({...catalogo,sconti:next}) }} /></label></article>)}</div><section className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/60 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200"><TicketPercent className="size-5" /></span><div><h2 className="text-lg font-bold text-amber-950">Codici sconto</h2><p className="text-sm font-medium text-amber-800/80">Archivio dei codici e di cosa comportano. L&apos;impatto sul calcolo sarà definito in uno step successivo.</p></div></div><Button type="button" onClick={addDiscountCode} className="bg-amber-600 text-white hover:bg-amber-700"><Plus className="size-4" />Aggiungi codice</Button></div>{(catalogo.codici_sconto ?? []).length === 0 ? <Empty>Nessun codice sconto configurato.</Empty> : <div className="space-y-3 p-4">{(catalogo.codici_sconto ?? []).map((code, index) => <article key={index} className="rounded-xl border border-amber-100 bg-amber-50/30 p-4"><div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)_150px_130px_90px_40px]"><label className="text-xs font-medium text-muted-foreground">Codice<Input className="mt-1 font-bold uppercase" value={code.codice} onChange={(e) => setDiscountCode(index, { codice: e.target.value })} /></label><label className="text-xs font-medium text-muted-foreground">Nome<Input className="mt-1 font-semibold" value={code.nome} onChange={(e) => setDiscountCode(index, { nome: e.target.value })} /></label><label className="text-xs font-medium text-muted-foreground">Tipo<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground" value={code.tipo} onChange={(e) => setDiscountCode(index, { tipo: e.target.value as CodiceSconto["tipo"] })}><option value="percentuale">Percentuale</option><option value="importo">Importo</option><option value="omaggio">Omaggio</option><option value="nota">Nota</option></select></label><label className="text-xs font-medium text-muted-foreground">Valore<Input className="mt-1 font-semibold" type="number" value={code.valore ?? 0} onChange={(e) => setDiscountCode(index, { valore: numberValue(e.target.value) })} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-medium">Attivo<Switch checked={code.attivo} onCheckedChange={(checked) => setDiscountCode(index, { attivo: checked })} /></label><Button type="button" variant="ghost" size="icon-sm" aria-label={`Rimuovi ${code.codice}`} onClick={() => removeDiscountCode(index)}><Trash2 className="size-4 text-destructive" /></Button></div><Textarea className="mt-3 bg-white" value={code.descrizione ?? ""} onChange={(e) => setDiscountCode(index, { descrizione: e.target.value })} placeholder="Descrivi cosa comporta il codice: es. sconto extra, accessorio incluso, promo limitata, vincoli di applicazione..." /></article>)}</div>}</section><Textarea className="bg-white" value={catalogo.note ?? ""} onChange={(e) => setCatalogo({...catalogo,note:e.target.value})} placeholder="Note e condizioni commerciali" /></TabsContent>

                <TabsContent value="offerte-admin" className="pt-5">{data.offerte.length === 0 ? <Empty>Carica PDF e copertine nelle offerte del periodo, poi avvia la sincronizzazione.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{data.offerte.map((offer) => <article key={offer.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">{offer.cover_path ? <img src={`/api/offerta-commerciale/offerte/${offer.id}/asset?kind=cover`} alt="" className="h-52 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-slate-100"><FileText className="size-10 text-muted-foreground" /></div>}<div className="space-y-3 p-4"><Input value={offer.titolo} onChange={(e) => setOffer(offer.id,{titolo:e.target.value})} /><Textarea value={offer.descrizione ?? ""} onChange={(e) => setOffer(offer.id,{descrizione:e.target.value})} placeholder="Descrizione breve" /><div className="grid grid-cols-2 gap-2"><Input type="date" value={offer.valido_dal ?? ""} onChange={(e) => setOffer(offer.id,{valido_dal:e.target.value || null})} /><Input type="date" value={offer.valido_al ?? ""} onChange={(e) => setOffer(offer.id,{valido_al:e.target.value || null})} /></div><div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm"><Switch checked={offer.pubblicata} onCheckedChange={(checked) => setOffer(offer.id,{pubblicata:checked})} />Pubblicata</label><div className="flex gap-2">{offer.pdf_path ? <Button variant="outline" size="sm" render={<a href={`/api/offerta-commerciale/offerte/${offer.id}/asset`} target="_blank" rel="noreferrer" />}>Apri PDF</Button> : null}<Button size="sm" onClick={() => saveOffer(offer)} className="bg-teal-600 hover:bg-teal-700">Salva</Button></div></div></div></article>)}</div>}</TabsContent>

                <TabsContent value="documenti-admin" className="space-y-5 pt-5"><section className="rounded-xl border border-border bg-white p-4 shadow-sm"><PanelTitle icon={Upload} title="Carica documenti" description="Massimo 25 MB per file. Per le offerte usa lo stesso nome per PDF e copertina." />{uploading ? <Loader2 className="mb-3 size-5 animate-spin text-blue-700" /> : null}<div className="grid gap-3 md:grid-cols-3"><label className="cursor-pointer rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-4 text-sm transition-colors hover:bg-blue-50"><span className="font-medium">Listini</span><span className="mt-1 block text-xs text-muted-foreground">Solo PDF</span><input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={(e) => { void uploadFiles("listini", e.target.files); e.target.value="" }} /></label><label className="cursor-pointer rounded-lg border border-dashed border-teal-200 bg-teal-50/50 p-4 text-sm transition-colors hover:bg-teal-50"><span className="font-medium">Offerte del periodo</span><span className="mt-1 block text-xs text-muted-foreground">PDF, JPG, PNG o WebP</span><input className="sr-only" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" disabled={uploading} onChange={(e) => { void uploadFiles("offerte", e.target.files); e.target.value="" }} /></label><label className="cursor-pointer rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm transition-colors hover:bg-slate-100"><span className="font-medium">Schede tecniche</span><span className="mt-1 block text-xs text-muted-foreground">Solo PDF</span><input className="sr-only" type="file" multiple accept="application/pdf,.pdf" disabled={uploading} onChange={(e) => { void uploadFiles("schede", e.target.files); e.target.value="" }} /></label></div></section><section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-border p-4"><Archive className="size-4 text-blue-700" /><h2 className="font-semibold">Storico listini</h2></div><table className="w-full text-sm"><tbody>{data.versioni.map((version) => <tr key={version.id} className="border-t border-border first:border-t-0"><td className="px-4 py-3 font-medium">{version.nome}</td><td className="px-4 py-3"><Badge variant={version.stato === "pubblicato" ? "default" : "outline"}>{version.stato}</Badge></td><td className="px-4 py-3 text-right text-muted-foreground">{new Date(version.aggiornato_at).toLocaleDateString("it-IT")}</td><td className="w-14 px-3 py-2 text-right">{version.stato === "archiviato" ? <Button variant="ghost" size="icon-sm" aria-label={`Elimina ${version.nome}`} disabled={deletingCatalog === version.id} onClick={() => void deleteCatalog(version.id, version.nome)}>{deletingCatalog === version.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}</Button> : null}</td></tr>)}</tbody></table></section>{data.documenti.length === 0 ? <Empty>Nessun documento sincronizzato da Nextcloud.</Empty> : <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-border p-4"><Cloud className="size-4 text-blue-700" /><h2 className="font-semibold">Documenti Nextcloud</h2></div><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Modificato</th></tr></thead><tbody>{data.documenti.map((doc) => <tr key={doc.id} className="border-t border-border"><td className="px-4 py-3"><div className="font-medium">{doc.nome}</div><div className="text-xs text-muted-foreground">{doc.path}</div></td><td className="px-4 py-3"><Badge variant="outline">{doc.tipo}</Badge></td><td className="px-4 py-3 text-muted-foreground">{doc.modificato_at ? new Date(doc.modificato_at).toLocaleDateString("it-IT") : "—"}</td></tr>)}</tbody></table></section>}</TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet> : <Badge variant="secondary" className="w-fit"><ShieldCheck className="size-3.5" />Permesso agente</Badge>}
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={BookOpenCheck} label="Listino" value={catalogo.nome} tone="blue" />
      <Metric icon={SolarPanel} label="Taglie FV" value={String(catalogo.fotovoltaico.length)} tone="teal" />
      <Metric icon={BatteryCharging} label="Accumuli" value={String(catalogo.accumuli.length)} tone="amber" />
      <Metric icon={PackageOpen} label="Offerte" value={String(activeOffers)} tone="slate" />
    </div>

    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100"><BookOpenCheck className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-950">{catalogo.nome}</p>
            <p className="mt-1 text-sm text-muted-foreground">{validitaListino} · stato {catalogo.stato}</p>
          </div>
        </div>
        <Badge className="bg-teal-600 text-white"><ShieldCheck className="size-3.5" />Listino in uso</Badge>
      </div>
    </section>

    <Tabs defaultValue="calcolo">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b border-border">
        <TabsTrigger value="calcolo"><Calculator className="size-4" />Calcolo offerta</TabsTrigger>
        <TabsTrigger value="offerte"><PackageOpen className="size-4" />Offerte del periodo</TabsTrigger>
      </TabsList>

      <TabsContent value="calcolo" className="pt-5"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-xl border border-border bg-white p-5 shadow-sm"><PanelTitle icon={Calculator} title="Configurazione offerta" description="Stima rapida basata sul listino attivo. Non crea ancora un preventivo." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Potenza fotovoltaico<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteKwp} onChange={(e) => setQuoteKwp(Number(e.target.value))}>{catalogo.fotovoltaico.map((row) => <option key={row.kwp} value={row.kwp}>{row.kwp} kWp</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Marca accumulo<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteBattery?.marca ?? ""} onChange={(e) => { const battery=catalogo.accumuli.find((item)=>item.marca===e.target.value); setQuoteBrand(e.target.value); if (battery) setQuoteKwh(battery.taglie[0]) }}>{catalogo.accumuli.map((item) => <option key={item.marca} value={item.marca}>{item.marca}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Capacità<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteKwh} onChange={(e) => setQuoteKwh(Number(e.target.value))}>{quoteBattery?.taglie.map((kwh) => <option key={kwh} value={kwh}>{kwh} kWh</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Zona commerciale<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteZone} onChange={(e) => setQuoteZone(e.target.value)}>{[...new Set(catalogo.sconti.map((rule)=>rule.zona))].map((zone)=><option key={zone} value={zone}>Zona {zone}</option>)}</select></label><label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">Includi EPS<Switch checked={quoteEps} onCheckedChange={setQuoteEps} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">EPS omaggio<Switch checked={quoteEpsGift} disabled={!quoteEps || !quoteRule?.eps_omaggiabile} onCheckedChange={setQuoteEpsGift} /></label></div>{quoteTotal == null ? <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Combinazione non presente nel listino: richiedere una verifica commerciale.</p> : null}</section><aside className="rounded-xl bg-blue-700 p-5 text-white shadow-sm"><p className="text-sm opacity-80">Totale indicativo IVA inclusa</p><p className="mt-2 text-4xl font-semibold">{quoteTotal == null ? "—" : euro.format(quoteTotal)}</p><div className="mt-6 space-y-2 border-t border-white/20 pt-4 text-sm"><div className="flex justify-between"><span>Fotovoltaico</span><span>{quoteBase == null ? "—" : euro.format(quoteBase)}</span></div><div className="flex justify-between"><span>Accumulo</span><span>{quoteStorage == null ? "—" : euro.format(quoteStorage)}</span></div><div className="flex justify-between"><span>Sconto {quoteRule?.percentuale ?? 0}%</span><span>- {euro.format(quoteDiscount)}</span></div>{quoteEps ? <div className="flex justify-between"><span>EPS</span><span>{quoteEpsPrice === 0 ? "Omaggio" : euro.format(quoteEpsPrice)}</span></div> : null}</div><div className="mt-5 rounded-lg bg-white/10 p-3 text-xs leading-relaxed text-white/80">Valore soggetto a sopralluogo, fattibilità tecnica e conferma delle condizioni commerciali.</div></aside></div></TabsContent>

      <TabsContent value="offerte" className="pt-5">{visibleOffers.length === 0 ? <Empty>Nessuna offerta pubblicata disponibile.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{visibleOffers.map((offer) => <article key={offer.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">{offer.cover_path ? <img src={`/api/offerta-commerciale/offerte/${offer.id}/asset?kind=cover`} alt="" className="h-52 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-slate-100"><FileText className="size-10 text-muted-foreground" /></div>}<div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{offer.titolo}</h2>{offer.descrizione ? <p className="mt-2 text-sm text-muted-foreground">{offer.descrizione}</p> : null}</div>{offer.pubblicata ? <Badge className="bg-teal-600">Pubblicata</Badge> : <Badge variant="outline">Bozza</Badge>}</div>{canManage ? <Badge variant={offer.testo_estratto ? "secondary" : "outline"}>{offer.testo_estratto ? `${offer.testo_estratto.length.toLocaleString("it-IT")} caratteri letti` : "solo PDF"}</Badge> : null}<div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground"><span>{offer.valido_dal ? new Date(offer.valido_dal).toLocaleDateString("it-IT") : "Data inizio libera"} - {offer.valido_al ? new Date(offer.valido_al).toLocaleDateString("it-IT") : "senza scadenza"}</span><div className="flex flex-wrap items-center gap-2">{offer.pdf_path ? <Button variant="outline" size="sm" render={<a href={`/api/offerta-commerciale/offerte/${offer.id}/asset`} target="_blank" rel="noreferrer" />}>Apri PDF</Button> : null}{offer.pdf_path && offer.pubblicata ? <Button variant="outline" size="sm" render={<a href={`/api/public/offerte-periodo/${offer.id}/pdf`} target="_blank" rel="noreferrer" />}>Link pubblico</Button> : null}</div></div>{canManage ? <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Switch checked={offer.pubblicata} onCheckedChange={(checked) => { const updated = { ...offer, pubblicata: checked }; setOffer(offer.id, { pubblicata: checked }); void saveOffer(updated, checked ? "Roberta puo usare questo PDF" : "PDF nascosto a Roberta") }} />Roberta</label> : null}</div></article>)}</div>}</TabsContent>
    </Tabs>
  </div>
}
