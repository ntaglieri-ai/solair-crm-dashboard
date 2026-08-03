"use client"
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeEuro, BatteryCharging, Calculator, FileText, Loader2, PackageOpen, RefreshCw, Save, ShieldCheck, SolarPanel, Tag, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { CatalogoCommerciale, OffertaCommercialePayload, OffertaPeriodo } from "@/lib/offerta-commerciale/types"

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function Metric({ icon: Icon, label, value }: { icon: typeof BadgeEuro; label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</div><div className="mt-2 text-2xl font-semibold text-foreground">{value}</div></div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{children}</div>
}

export function OffertaCommercialeClient() {
  const [data, setData] = useState<OffertaCommercialePayload | null>(null)
  const [catalogo, setCatalogo] = useState<CatalogoCommerciale | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
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
      toast.success(`Nextcloud sincronizzato: ${body.files} documenti, ${body.offerte} locandine`)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore sincronizzazione") }
    finally { setSyncing(false) }
  }

  const publishCatalog = async () => {
    if (!catalogo || catalogo.stato !== "bozza") return
    setSaving(true)
    try {
      const saveResponse = await fetch("/api/offerta-commerciale", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogo }) })
      const saveBody = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saveBody.error ?? "Salvataggio non riuscito")
      const response = await fetch("/api/offerta-commerciale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: catalogo.id, action: "publish" }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Pubblicazione non riuscita")
      toast.success("Nuovo listino pubblicato; il precedente è nello storico")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore pubblicazione") }
    finally { setSaving(false) }
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

  const saveOffer = async (offer: OffertaPeriodo) => {
    try {
      const response = await fetch("/api/offerta-commerciale/offerte", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(offer) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Salvataggio offerta non riuscito")
      toast.success(`Offerta ${offer.titolo} salvata`)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore salvataggio") }
  }

  const activeOffers = useMemo(() => data?.offerte.filter((offer) => offer.pubblicata).length ?? 0, [data])
  const canManage = data?.canManage === true

  if (loading && !data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>
  if (!catalogo || !data) return <Empty>Il modulo richiede la migrazione database “20260803_offerta_commerciale.sql”.</Empty>

  const setOffer = (id: string, patch: Partial<OffertaPeriodo>) => setData((current) => current ? { ...current, offerte: current.offerte.map((offer) => offer.id === id ? { ...offer, ...patch } : offer) } : current)
  const quoteBattery = catalogo.accumuli.find((item) => item.marca === quoteBrand) ?? catalogo.accumuli[0]
  const quoteCapacityIndex = quoteBattery?.taglie.indexOf(quoteKwh) ?? -1
  const quoteBase = catalogo.fotovoltaico.find((item) => item.kwp === quoteKwp)?.prezzo ?? null
  const quoteStorage = quoteBattery && quoteCapacityIndex >= 0 ? quoteBattery.prezzi[String(quoteKwp)]?.[quoteCapacityIndex] ?? null : null
  const quoteRule = catalogo.sconti.find((rule) => rule.zona === quoteZone && quoteKwp >= rule.kwp_min && quoteKwp <= rule.kwp_max)
  const quoteSubtotal = quoteBase != null && quoteStorage != null ? quoteBase + quoteStorage : null
  const quoteDiscount = quoteSubtotal != null && quoteRule ? quoteSubtotal * quoteRule.percentuale / 100 : 0
  const quoteEpsPrice = quoteEps && !(quoteEpsGift && quoteRule?.eps_omaggiabile) ? quoteRule?.eps_prezzo ?? 0 : 0
  const quoteTotal = quoteSubtotal != null ? quoteSubtotal - quoteDiscount + quoteEpsPrice : null

  return <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-2 flex items-center gap-2"><BadgeEuro className="size-5 text-primary" /><span className="text-sm font-semibold uppercase tracking-wide text-primary">Catalogo aziendale</span></div><h1 className="text-3xl font-semibold tracking-tight text-foreground">Offerta Commerciale</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Listini, accumuli, regole commerciali e offerte del periodo. I documenti originali restano su Nextcloud.</p></div>
      {canManage ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={syncNextcloud} disabled={syncing}>{syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Sincronizza Nextcloud</Button><Button variant="outline" onClick={saveCatalog} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salva</Button>{catalogo.stato === "bozza" ? <Button onClick={publishCatalog} disabled={saving}><ShieldCheck className="size-4" />Pubblica listino</Button> : null}</div> : <Badge variant="secondary" className="w-fit"><ShieldCheck className="size-3.5" />Sola lettura</Badge>}
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={SolarPanel} label="Taglie fotovoltaico" value={String(catalogo.fotovoltaico.length)} />
      <Metric icon={BatteryCharging} label="Marche accumulo" value={String(catalogo.accumuli.length)} />
      <Metric icon={Tag} label="Regole commerciali" value={String(catalogo.sconti.length)} />
      <Metric icon={PackageOpen} label="Offerte pubblicate" value={String(activeOffers)} />
    </div>

    <section className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_170px_170px]">
        <Input value={catalogo.nome} disabled={!canManage} onChange={(event) => setCatalogo({ ...catalogo, nome: event.target.value })} aria-label="Nome listino" />
        <Input type="date" value={catalogo.valido_dal ?? ""} disabled={!canManage} onChange={(event) => setCatalogo({ ...catalogo, valido_dal: event.target.value || null })} aria-label="Valido dal" />
        <Input type="date" value={catalogo.valido_al ?? ""} disabled={!canManage} onChange={(event) => setCatalogo({ ...catalogo, valido_al: event.target.value || null })} aria-label="Valido al" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Fonte Nextcloud: {data.nextcloudRoot} · Stato: {catalogo.stato}</p>
    </section>

    <Tabs defaultValue="calcolo">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b border-border">
        <TabsTrigger value="calcolo">Calcolo rapido</TabsTrigger><TabsTrigger value="fotovoltaico">Fotovoltaico</TabsTrigger><TabsTrigger value="accumuli">Accumuli</TabsTrigger><TabsTrigger value="accessori">Accessori</TabsTrigger><TabsTrigger value="regole">Regole</TabsTrigger><TabsTrigger value="offerte">Offerte del periodo</TabsTrigger><TabsTrigger value="documenti">Documenti</TabsTrigger>
      </TabsList>

      <TabsContent value="calcolo" className="pt-5"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-center gap-2"><Calculator className="size-5 text-primary" /><div><h2 className="font-semibold">Configurazione di consultazione</h2><p className="text-sm text-muted-foreground">Il calcolo non modifica il listino e non crea un preventivo.</p></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Potenza fotovoltaico<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteKwp} onChange={(e) => setQuoteKwp(Number(e.target.value))}>{catalogo.fotovoltaico.map((row) => <option key={row.kwp} value={row.kwp}>{row.kwp} kWp</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Marca accumulo<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteBattery?.marca ?? ""} onChange={(e) => { const battery=catalogo.accumuli.find((item)=>item.marca===e.target.value); setQuoteBrand(e.target.value); if (battery) setQuoteKwh(battery.taglie[0]) }}>{catalogo.accumuli.map((item) => <option key={item.marca} value={item.marca}>{item.marca}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Capacità<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteKwh} onChange={(e) => setQuoteKwh(Number(e.target.value))}>{quoteBattery?.taglie.map((kwh) => <option key={kwh} value={kwh}>{kwh} kWh</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Zona commerciale<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={quoteZone} onChange={(e) => setQuoteZone(e.target.value)}>{[...new Set(catalogo.sconti.map((rule)=>rule.zona))].map((zone)=><option key={zone} value={zone}>Zona {zone}</option>)}</select></label><label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">Includi EPS<Switch checked={quoteEps} onCheckedChange={setQuoteEps} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">EPS omaggio<Switch checked={quoteEpsGift} disabled={!quoteEps || !quoteRule?.eps_omaggiabile} onCheckedChange={setQuoteEpsGift} /></label></div>{quoteTotal == null ? <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Combinazione non presente nel listino: richiedere una verifica commerciale.</p> : null}</section><aside className="rounded-xl bg-primary p-5 text-primary-foreground"><p className="text-sm opacity-80">Totale indicativo IVA inclusa</p><p className="mt-2 text-4xl font-semibold">{quoteTotal == null ? "—" : euro.format(quoteTotal)}</p><div className="mt-6 space-y-2 border-t border-primary-foreground/20 pt-4 text-sm"><div className="flex justify-between"><span>Fotovoltaico</span><span>{quoteBase == null ? "—" : euro.format(quoteBase)}</span></div><div className="flex justify-between"><span>Accumulo</span><span>{quoteStorage == null ? "—" : euro.format(quoteStorage)}</span></div><div className="flex justify-between"><span>Sconto {quoteRule?.percentuale ?? 0}%</span><span>- {euro.format(quoteDiscount)}</span></div>{quoteEps ? <div className="flex justify-between"><span>EPS</span><span>{quoteEpsPrice === 0 ? "Omaggio" : euro.format(quoteEpsPrice)}</span></div> : null}</div><p className="mt-5 text-xs leading-relaxed opacity-75">Valore di consultazione soggetto a sopralluogo, fattibilità tecnica e conferma delle condizioni commerciali.</p></aside></div></TabsContent>

      <TabsContent value="fotovoltaico" className="pt-5"><section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-semibold">Fotovoltaico senza accumulo</h2><p className="text-sm text-muted-foreground">Prezzi IVA inclusa per taglia nominale.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="px-4 py-3">Potenza</th><th className="px-4 py-3">Prezzo</th></tr></thead><tbody>{catalogo.fotovoltaico.map((row, index) => <tr key={`${row.kwp}-${index}`} className="border-t border-border"><td className="px-4 py-2">{canManage ? <Input className="max-w-28" type="number" value={row.kwp} onChange={(e) => { const next = [...catalogo.fotovoltaico]; next[index] = { ...row, kwp: numberValue(e.target.value) }; setCatalogo({ ...catalogo, fotovoltaico: next }) }} /> : `${row.kwp} kWp`}</td><td className="px-4 py-2">{canManage ? <Input className="max-w-40" type="number" value={row.prezzo} onChange={(e) => { const next = [...catalogo.fotovoltaico]; next[index] = { ...row, prezzo: numberValue(e.target.value) }; setCatalogo({ ...catalogo, fotovoltaico: next }) }} /> : euro.format(row.prezzo)}</td></tr>)}</tbody></table></div></section></TabsContent>

      <TabsContent value="accumuli" className="space-y-5 pt-5">{catalogo.accumuli.map((battery, batteryIndex) => <section key={battery.marca} className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4"><div><h2 className="font-semibold">{battery.marca}</h2><p className="text-xs text-muted-foreground">{battery.tensione ? `${battery.tensione} tensione` : ""} {battery.ip ? `· ${battery.ip}` : ""} {battery.garanzia_anni ? `· ${battery.garanzia_anni} anni` : ""}</p></div><Badge variant="outline">Sovrapprezzo accumulo</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-3 text-left">kWp</th>{battery.taglie.map((kwh) => <th key={kwh} className="px-3 py-3 text-right">{kwh} kWh</th>)}</tr></thead><tbody>{Object.keys(battery.prezzi).sort((a,b) => Number(a)-Number(b)).map((kwp) => <tr key={kwp} className="border-t border-border"><td className="px-3 py-2 font-medium">{kwp} kWp</td>{battery.taglie.map((_, priceIndex) => <td key={priceIndex} className="px-3 py-2 text-right">{canManage ? <Input className="ml-auto w-28 text-right" type="number" value={battery.prezzi[kwp]?.[priceIndex] ?? 0} onChange={(e) => { const accumuli = structuredClone(catalogo.accumuli); accumuli[batteryIndex].prezzi[kwp][priceIndex] = numberValue(e.target.value); setCatalogo({ ...catalogo, accumuli }) }} /> : euro.format(battery.prezzi[kwp]?.[priceIndex] ?? 0)}</td>)}</tr>)}</tbody></table></div></section>)}</TabsContent>

      <TabsContent value="accessori" className="pt-5"><section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-semibold">Accessori</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="px-4 py-3">Accessorio</th><th className="px-4 py-3">Prezzo</th><th className="px-4 py-3">Unità</th><th className="px-4 py-3">Scontabile</th></tr></thead><tbody>{catalogo.accessori.map((item,index) => <tr key={`${item.nome}-${index}`} className="border-t border-border"><td className="px-4 py-2">{canManage ? <Input value={item.nome} onChange={(e) => { const next=[...catalogo.accessori]; next[index]={...item,nome:e.target.value}; setCatalogo({...catalogo,accessori:next}) }} /> : item.nome}</td><td className="px-4 py-2">{canManage ? <Input className="w-32" type="number" value={item.prezzo} onChange={(e) => { const next=[...catalogo.accessori]; next[index]={...item,prezzo:numberValue(e.target.value)}; setCatalogo({...catalogo,accessori:next}) }} /> : euro.format(item.prezzo)}</td><td className="px-4 py-2">{item.unita}</td><td className="px-4 py-2"><Switch checked={item.scontabile} disabled={!canManage} onCheckedChange={(checked) => { const next=[...catalogo.accessori]; next[index]={...item,scontabile:checked}; setCatalogo({...catalogo,accessori:next}) }} /></td></tr>)}</tbody></table></div></section></TabsContent>

      <TabsContent value="regole" className="pt-5"><div className="grid gap-4 lg:grid-cols-3">{catalogo.sconti.map((rule,index) => <article key={`${rule.zona}-${rule.kwp_min}-${index}`} className="rounded-xl border border-border bg-card p-4"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Zona {rule.zona}</h3><Badge>{rule.percentuale}%</Badge></div><div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Da kWp<Input type="number" disabled={!canManage} value={rule.kwp_min} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,kwp_min:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label><label className="text-xs text-muted-foreground">A kWp<Input type="number" disabled={!canManage} value={rule.kwp_max} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,kwp_max:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label><label className="text-xs text-muted-foreground">Sconto %<Input type="number" disabled={!canManage} value={rule.percentuale} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,percentuale:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label><label className="text-xs text-muted-foreground">EPS<Input type="number" disabled={!canManage} value={rule.eps_prezzo} onChange={(e) => { const next=[...catalogo.sconti]; next[index]={...rule,eps_prezzo:numberValue(e.target.value)}; setCatalogo({...catalogo,sconti:next}) }} /></label></div><label className="mt-4 flex items-center justify-between text-sm">EPS omaggiabile<Switch checked={rule.eps_omaggiabile} disabled={!canManage} onCheckedChange={(checked) => { const next=[...catalogo.sconti]; next[index]={...rule,eps_omaggiabile:checked}; setCatalogo({...catalogo,sconti:next}) }} /></label></article>)}</div><Textarea className="mt-4" value={catalogo.note ?? ""} disabled={!canManage} onChange={(e) => setCatalogo({...catalogo,note:e.target.value})} placeholder="Note e condizioni commerciali" /></TabsContent>

      <TabsContent value="offerte" className="pt-5">{data.offerte.length === 0 ? <Empty>Carica PDF e copertine in “Offerte-del-periodo” su Nextcloud, poi avvia la sincronizzazione.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{data.offerte.map((offer) => <article key={offer.id} className="overflow-hidden rounded-xl border border-border bg-card">{offer.cover_path ? <img src={`/api/offerta-commerciale/offerte/${offer.id}/asset?kind=cover`} alt="" className="h-52 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-muted"><FileText className="size-10 text-muted-foreground" /></div>}<div className="space-y-3 p-4"><Input value={offer.titolo} disabled={!canManage} onChange={(e) => setOffer(offer.id,{titolo:e.target.value})} /><Textarea value={offer.descrizione ?? ""} disabled={!canManage} onChange={(e) => setOffer(offer.id,{descrizione:e.target.value})} placeholder="Descrizione breve" /><div className="grid grid-cols-2 gap-2"><Input type="date" value={offer.valido_dal ?? ""} disabled={!canManage} onChange={(e) => setOffer(offer.id,{valido_dal:e.target.value || null})} /><Input type="date" value={offer.valido_al ?? ""} disabled={!canManage} onChange={(e) => setOffer(offer.id,{valido_al:e.target.value || null})} /></div><div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm"><Switch checked={offer.pubblicata} disabled={!canManage} onCheckedChange={(checked) => setOffer(offer.id,{pubblicata:checked})} />Pubblicata</label><div className="flex gap-2">{offer.pdf_path ? <Button variant="outline" size="sm" render={<a href={`/api/offerta-commerciale/offerte/${offer.id}/asset`} target="_blank" rel="noreferrer" />}>Apri PDF</Button> : null}{canManage ? <Button size="sm" onClick={() => saveOffer(offer)}>Salva</Button> : null}</div></div></div></article>)}</div>}</TabsContent>

      <TabsContent value="documenti" className="space-y-5 pt-5">{canManage ? <section className="rounded-xl border border-border bg-card p-4"><div className="mb-4 flex items-center gap-2"><Upload className="size-5 text-primary" /><div><h2 className="font-semibold">Carica su Nextcloud</h2><p className="text-sm text-muted-foreground">Massimo 25 MB per file. Per le offerte usa lo stesso nome per PDF e copertina.</p></div>{uploading ? <Loader2 className="ml-auto size-5 animate-spin text-primary" /> : null}</div><div className="grid gap-3 md:grid-cols-3"><label className="cursor-pointer rounded-lg border border-dashed border-border p-4 text-sm transition-colors hover:bg-muted/50"><span className="font-medium">Listini</span><span className="mt-1 block text-xs text-muted-foreground">Solo PDF</span><input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={(e) => { void uploadFiles("listini", e.target.files); e.target.value="" }} /></label><label className="cursor-pointer rounded-lg border border-dashed border-border p-4 text-sm transition-colors hover:bg-muted/50"><span className="font-medium">Offerte del periodo</span><span className="mt-1 block text-xs text-muted-foreground">PDF, JPG, PNG o WebP · selezione multipla</span><input className="sr-only" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" disabled={uploading} onChange={(e) => { void uploadFiles("offerte", e.target.files); e.target.value="" }} /></label><label className="cursor-pointer rounded-lg border border-dashed border-border p-4 text-sm transition-colors hover:bg-muted/50"><span className="font-medium">Schede tecniche</span><span className="mt-1 block text-xs text-muted-foreground">Solo PDF</span><input className="sr-only" type="file" multiple accept="application/pdf,.pdf" disabled={uploading} onChange={(e) => { void uploadFiles("schede", e.target.files); e.target.value="" }} /></label></div></section> : null}<section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-semibold">Storico listini</h2></div><table className="w-full text-sm"><tbody>{data.versioni.map((version) => <tr key={version.id} className="border-t border-border first:border-t-0"><td className="px-4 py-3 font-medium">{version.nome}</td><td className="px-4 py-3"><Badge variant={version.stato === "pubblicato" ? "default" : "outline"}>{version.stato}</Badge></td><td className="px-4 py-3 text-right text-muted-foreground">{new Date(version.aggiornato_at).toLocaleDateString("it-IT")}</td></tr>)}</tbody></table></section>{data.documenti.length === 0 ? <Empty>Nessun documento sincronizzato da Nextcloud.</Empty> : <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-4"><h2 className="font-semibold">Documenti Nextcloud</h2></div><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Modificato</th></tr></thead><tbody>{data.documenti.map((doc) => <tr key={doc.id} className="border-t border-border"><td className="px-4 py-3"><div className="font-medium">{doc.nome}</div><div className="text-xs text-muted-foreground">{doc.path}</div></td><td className="px-4 py-3"><Badge variant="outline">{doc.tipo}</Badge></td><td className="px-4 py-3 text-muted-foreground">{doc.modificato_at ? new Date(doc.modificato_at).toLocaleDateString("it-IT") : "—"}</td></tr>)}</tbody></table></section>}</TabsContent>
    </Tabs>
  </div>
}
