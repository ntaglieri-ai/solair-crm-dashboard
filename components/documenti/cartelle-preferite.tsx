"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Folder,
  ExternalLink,
  Plus,
  Trash2,
  ChevronRight,
  Home,
  Loader2,
  Star,
} from "lucide-react"

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
import { cn } from "@/lib/utils"

type BrowseFolder = { name: string; path: string; favorite: boolean }

/** Segmenti path -> breadcrumb con path cumulativo per la navigazione. */
function breadcrumbSegments(path: string): { name: string; path: string }[] {
  if (!path) return []
  const parts = path.split("/").filter(Boolean)
  const acc: { name: string; path: string }[] = []
  let cur = ""
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p
    acc.push({ name: p, path: cur })
  }
  return acc
}

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
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Stato del browser cartelle.
  const [browsePath, setBrowsePath] = useState("") // "" = root files
  const [folders, setFolders] = useState<BrowseFolder[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)

  const loadFolder = useCallback(async (path: string) => {
    setLoadingBrowse(true)
    setBrowseError(null)
    try {
      const res = await fetch(`/api/documenti/browse?path=${encodeURIComponent(path)}`)
      const body = (await res.json().catch(() => null)) as {
        folders?: BrowseFolder[]
        error?: string
      } | null
      if (!res.ok) throw new Error(body?.error ?? "Impossibile leggere la cartella")
      setFolders(body?.folders ?? [])
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : "Errore")
      setFolders([])
    } finally {
      setLoadingBrowse(false)
    }
  }, [])

  // All'apertura della modale ripartiamo dalla root.
  useEffect(() => {
    if (!open) return
    setBrowsePath("")
    setLabel("")
    setError(null)
    void loadFolder("")
  }, [open, loadFolder])

  function navigateTo(path: string) {
    setBrowsePath(path)
    // Label di default = nome dell'ultima cartella (l'utente puo' modificarla).
    setLabel(path ? (path.split("/").pop() ?? "") : "")
    void loadFolder(path)
  }

  async function addFavorite(e: React.FormEvent) {
    e.preventDefault()
    if (!browsePath) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/documenti/preferiti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: browsePath, label }),
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
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={addFavorite}>
            <DialogHeader>
              <DialogTitle>Aggiungi cartella preferita</DialogTitle>
              <DialogDescription>
                Sfoglia le tue cartelle Nextcloud e scegli quella da aggiungere ai preferiti.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {/* Breadcrumb di navigazione */}
              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => navigateTo("")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-foreground",
                    !browsePath && "font-medium text-foreground",
                  )}
                >
                  <Home className="size-3.5" aria-hidden="true" />
                  Home
                </button>
                {breadcrumbSegments(browsePath).map((seg) => (
                  <span key={seg.path} className="inline-flex items-center gap-1">
                    <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => navigateTo(seg.path)}
                      className={cn(
                        "rounded px-1.5 py-0.5 hover:text-foreground",
                        seg.path === browsePath && "font-medium text-foreground",
                      )}
                    >
                      {seg.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* Elenco sottocartelle */}
              <div className="max-h-64 min-h-[8rem] overflow-y-auto rounded-lg border border-border">
                {loadingBrowse ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  </div>
                ) : browseError ? (
                  <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-destructive">
                    {browseError}
                  </div>
                ) : folders.length === 0 ? (
                  <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Nessuna sottocartella qui.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {folders.map((f) => (
                      <li key={f.path}>
                        <button
                          type="button"
                          onClick={() => navigateTo(f.path)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Folder className="size-4 shrink-0 text-[#2E8B72]" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          {f.favorite ? (
                            <Star
                              className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
                              aria-label="Preferito su Nextcloud"
                            />
                          ) : null}
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Cartella selezionata + etichetta */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-label">Etichetta</Label>
                <Input
                  id="fav-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nome della cartella"
                  disabled={!browsePath}
                />
                <p className="truncate text-xs text-muted-foreground">
                  {browsePath ? `/${browsePath}` : "Naviga in una cartella per selezionarla."}
                </p>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={saving || !browsePath}>
                {saving ? "Salvataggio..." : "Aggiungi questa cartella"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
