"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconListDetails,
  IconPin,
  IconPlus,
  IconSpeakerphone,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { usePermissions } from "@/lib/permissions/provider"
import {
  BACHECA_MANAGE_ACTION,
  type BachecaLivello,
  type BachecaMessaggio,
} from "@/lib/bacheca/types"

/** Deve restare allineato al `gap` di .bacheca-ticker-track in globals.css. */
const TICKER_GAP_PX = 8
/** Velocita' di scorrimento in px/s: lenta abbastanza da restare leggibile. */
const TICKER_SPEED = 22
const REFRESH_MS = 60_000

const LIVELLI: Array<{
  value: BachecaLivello
  label: string
  icon: typeof IconInfoCircle
}> = [
  { value: "info", label: "Informativo", icon: IconInfoCircle },
  { value: "attenzione", label: "Attenzione", icon: IconAlertCircle },
  { value: "urgente", label: "Urgente", icon: IconAlertTriangle },
]

function livelloMeta(livello: BachecaLivello) {
  return LIVELLI.find((entry) => entry.value === livello) ?? LIVELLI[0]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function TickerRow({ item }: { item: BachecaMessaggio }) {
  const Icon = livelloMeta(item.livello).icon
  return (
    <div className="bacheca-row" data-livello={item.livello}>
      <span className="bacheca-chip">
        <Icon size={16} stroke={1.9} />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm leading-5">
        <strong className="font-bold text-foreground">{item.titolo}</strong>
        <span className="text-muted-foreground"> — {item.testo}</span>
      </p>
      {item.pin ? (
        <IconPin
          size={15}
          stroke={1.9}
          className="shrink-0 text-[#a85e00]"
          aria-label="Annuncio fissato"
        />
      ) : null}
    </div>
  )
}

/**
 * Area a scorrimento continuo. Il track viene traslato a mano via
 * requestAnimationFrame (niente `animation` CSS) perche' serve poterlo fermare
 * a meta' corsa al passaggio del mouse e riprendere senza salti. Il loop e'
 * seamless duplicando l'elenco: quando l'offset raggiunge l'altezza di una
 * copia (piu' il gap che la separa dalla successiva) torna a zero, e la copia
 * duplicata si trova esattamente nella stessa posizione.
 */
function Ticker({ items }: { items: BachecaMessaggio[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const pausedRef = useRef(false)
  const [overflowing, setOverflowing] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  // Con "riduci animazioni" attivo l'area diventa scrollabile a mano (regola
  // prefers-reduced-motion in globals.css) e non si duplica nulla.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  // L'elenco si duplica (e quindi scorre) solo se non ci sta gia' tutto
  // nell'area visibile: con 2-3 annunci il widget resta fermo e leggibile.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const group = groupRef.current
    if (!viewport || !group) return

    const measure = () => setOverflowing(group.offsetHeight > viewport.clientHeight + 1)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(group)
    return () => observer.disconnect()
  }, [items])

  const looping = overflowing && !reduceMotion

  useEffect(() => {
    offsetRef.current = 0
    const track = trackRef.current
    if (track) track.style.transform = "translate3d(0, 0, 0)"
  }, [items])

  useEffect(() => {
    if (!looping) return

    const trackAtMount = trackRef.current
    let frame = 0
    let last = performance.now()

    const step = (now: number) => {
      // Clamp del delta: tornando su una tab lasciata in background il salto
      // accumulato sarebbe di secondi interi.
      const delta = Math.min(now - last, 64)
      last = now

      const track = trackRef.current
      const group = groupRef.current
      if (track && group && !pausedRef.current) {
        const loop = group.offsetHeight + TICKER_GAP_PX
        if (loop > 0) {
          offsetRef.current = (offsetRef.current + (TICKER_SPEED * delta) / 1000) % loop
          track.style.transform = `translate3d(0, ${-offsetRef.current}px, 0)`
        }
      }

      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      // Se il loop si spegne (meno annunci, finestra piu' alta, riduci
      // animazioni) il track deve tornare a zero, non restare a meta' corsa.
      offsetRef.current = 0
      if (trackAtMount) trackAtMount.style.transform = "translate3d(0, 0, 0)"
    }
  }, [looping])

  return (
    <div
      ref={viewportRef}
      className="bacheca-ticker"
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
    >
      <div ref={trackRef} className="bacheca-ticker-track">
        <div ref={groupRef} className="bacheca-ticker-group">
          {items.map((item) => (
            <TickerRow key={item.id} item={item} />
          ))}
        </div>
        {looping ? (
          <div className="bacheca-ticker-group" aria-hidden="true">
            {items.map((item) => (
              <TickerRow key={`clone-${item.id}`} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function NuovoAnnuncioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [titolo, setTitolo] = useState("")
  const [testo, setTesto] = useState("")
  const [livello, setLivello] = useState<BachecaLivello>("info")
  const [pin, setPin] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitolo("")
    setTesto("")
    setLivello("info")
    setPin(false)
  }

  async function handleSave() {
    if (!titolo.trim() || !testo.trim()) {
      toast.error("Inserisci titolo e testo")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/bacheca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titolo, testo, livello, pin }),
      })
      if (!res.ok) throw new Error("Pubblicazione non riuscita")
      toast.success("Annuncio pubblicato")
      reset()
      onOpenChange(false)
      onCreated()
    } catch {
      toast.error("Pubblicazione non riuscita")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo annuncio</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bacheca-titolo">Titolo</Label>
            <Input
              id="bacheca-titolo"
              value={titolo}
              maxLength={120}
              onChange={(event) => setTitolo(event.target.value)}
              placeholder="Es. Chiusura uffici venerdi'"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bacheca-testo">Testo</Label>
            <Textarea
              id="bacheca-testo"
              value={testo}
              maxLength={1000}
              onChange={(event) => setTesto(event.target.value)}
              placeholder="Scrivi la comunicazione per il team..."
              className="min-h-24"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bacheca-livello">Livello</Label>
            <Select
              value={livello}
              onValueChange={(value) => setLivello(value as BachecaLivello)}
            >
              <SelectTrigger id="bacheca-livello">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIVELLI.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5">
            <Label htmlFor="bacheca-pin" className="cursor-pointer">
              Fissa in alto
            </Label>
            <Switch id="bacheca-pin" checked={pin} onCheckedChange={setPin} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Pubblicazione..." : "Pubblica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VediTutteDialog({
  open,
  onOpenChange,
  items,
  canManage,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: BachecaMessaggio[]
  canManage: boolean
  onDeleted: () => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/bacheca/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      toast.success("Annuncio eliminato")
      onDeleted()
    } catch {
      toast.error("Eliminazione non riuscita")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bacheca aziendale</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[62vh] gap-2 overflow-y-auto py-1 pr-1">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/25 px-6 py-8 text-center text-sm text-muted-foreground">
              Nessun annuncio pubblicato.
            </p>
          ) : (
            items.map((item) => {
              const Icon = livelloMeta(item.livello).icon
              return (
                <div key={item.id} className="bacheca-row items-start" data-livello={item.livello}>
                  <span className="bacheca-chip mt-0.5">
                    <Icon size={16} stroke={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-sm font-bold text-foreground">{item.titolo}</strong>
                      {item.pin ? (
                        <IconPin
                          size={14}
                          stroke={1.9}
                          className="shrink-0 text-[#a85e00]"
                          aria-label="Annuncio fissato"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/75">
                      {item.testo}
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                      {item.autore ? `${item.autore} · ` : ""}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Elimina annuncio ${item.titolo}`}
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <IconTrash size={16} stroke={1.9} />
                    </Button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Widget Bacheca aziendale: ticker degli annunci nella card di dashboard, piu'
 * i due dialog "Vedi tutte" e "+ Nuovo annuncio". L'elenco iniziale arriva
 * renderizzato dal server; da li' in poi si aggiorna da GET /api/bacheca ogni
 * 60s — gli annunci cambiano raramente, il realtime sarebbe sproporzionato.
 */
export function BachecaWidget({
  initialItems,
}: {
  initialItems: BachecaMessaggio[]
}) {
  const permissions = usePermissions()
  const canManage = permissions.canAction(BACHECA_MANAGE_ACTION)

  const [items, setItems] = useState<BachecaMessaggio[]>(initialItems)
  const [nuovoOpen, setNuovoOpen] = useState(false)
  const [tutteOpen, setTutteOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bacheca", { cache: "no-store" })
      if (!res.ok) return
      const payload = (await res.json()) as { items?: BachecaMessaggio[] }
      setItems(payload.items ?? [])
    } catch {
      // Silenzioso: il widget resta sull'ultimo elenco valido.
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <IconSpeakerphone size={20} stroke={1.9} className="text-[#a85e00]" />
          Bacheca aziendale
        </h2>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button onClick={() => setNuovoOpen(true)}>
              <IconPlus stroke={2} data-icon="inline-start" />
              Nuovo annuncio
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setTutteOpen(true)}>
            <IconListDetails stroke={2} data-icon="inline-start" />
            Vedi tutte
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-6 py-10 text-center">
          <div>
            <p className="text-base font-semibold text-foreground">Nessun annuncio</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Le comunicazioni aziendali pubblicate appariranno qui.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <Ticker items={items} />
        </div>
      )}

      <NuovoAnnuncioDialog
        open={nuovoOpen}
        onOpenChange={setNuovoOpen}
        onCreated={() => void refresh()}
      />
      <VediTutteDialog
        open={tutteOpen}
        onOpenChange={setTutteOpen}
        items={items}
        canManage={canManage}
        onDeleted={() => void refresh()}
      />
    </>
  )
}
