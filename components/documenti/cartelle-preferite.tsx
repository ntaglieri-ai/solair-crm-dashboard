"use client"

import { useState } from "react"
import { Folder, ExternalLink, Plus, Trash2 } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type CartellaPreferita, openNextcloudUrl } from "@/lib/documenti-data"

function CartellaCard({
  cartella,
  onRemove,
}: {
  cartella: CartellaPreferita
  onRemove: (id: string) => void
}) {
  return (
    <Card className="flex-row items-start justify-between gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#2E8B72]/12 text-[#2E8B72]">
          <Folder className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{cartella.label}</p>
          <p className="truncate text-xs text-muted-foreground">/{cartella.path}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Rimuovi preferito"
          onClick={() => onRemove(cartella.id)}
        >
          <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          className="gap-1.5 bg-card"
          render={<a href={openNextcloudUrl(cartella.path)} target="_blank" rel="noopener noreferrer" />}
        >
          Apri
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}

export function CartellePreferite({ cartelle }: { cartelle: CartellaPreferita[] }) {
  const [items, setItems] = useState<CartellaPreferita[]>(cartelle)
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState("")
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function addFavorite(e: React.FormEvent) {
    e.preventDefault()
    if (!path.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/documenti/preferiti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, label }),
      })
      const body = (await res.json().catch(() => null)) as {
        preferito?: CartellaPreferita
        error?: string
      } | null
      if (!res.ok || !body?.preferito) {
        throw new Error(body?.error ?? "Impossibile aggiungere il preferito")
      }
      setItems((prev) =>
        [...prev.filter((p) => p.id !== body.preferito!.id), body.preferito!].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      )
      setOpen(false)
      setPath("")
      setLabel("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore")
    } finally {
      setSaving(false)
    }
  }

  async function removeFavorite(id: string) {
    const prev = items
    setItems((cur) => cur.filter((c) => c.id !== id))
    const res = await fetch(`/api/documenti/preferiti?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) setItems(prev) // rollback
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Cartelle preferite</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((c) => (
          <CartellaCard key={c.id} cartella={c} onRemove={removeFavorite} />
        ))}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[92px] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Aggiungi cartella
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={addFavorite}>
            <DialogHeader>
              <DialogTitle>Aggiungi cartella preferita</DialogTitle>
              <DialogDescription>
                Inserisci il percorso Nextcloud relativo alla tua cartella files (es.
                LISTINI/2026).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-path">Percorso</Label>
                <Input
                  id="fav-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="LISTINI/2026"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-label">Etichetta (opzionale)</Label>
                <Input
                  id="fav-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Listini 2026"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={saving || !path.trim()}>
                {saving ? "Salvataggio..." : "Aggiungi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
