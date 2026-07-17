"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, History, Megaphone, Pencil, Pin, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export type NoticeboardItem = {
  id: string
  title: string
  body: string
  author: string
  createdAt: string
  pinned: boolean
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function recentItems(items: NoticeboardItem[]) {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  return items.filter((item) => new Date(item.createdAt) >= cutoff)
}

function NoticeArticle({
  item,
  compact,
  actions,
}: {
  item: NoticeboardItem
  compact: boolean
  actions?: React.ReactNode
}) {
  return (
    <article
      className={
        compact
          ? "group flex gap-3 rounded-lg border border-[#ead8a7] bg-[#fffaf0] p-4 transition-colors hover:bg-[#fff7e6]"
          : "group flex gap-4 rounded-lg border border-black/8 bg-white/75 p-5 transition-colors hover:bg-white"
      }
    >
      <div className="pt-1">
        {item.pinned ? (
          <Pin className="size-5 fill-[#f4b942] text-[#a85e00]" />
        ) : (
          <span className="block size-2.5 rounded-full bg-[#4f7cff]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={compact ? "text-base font-bold text-foreground" : "text-lg font-bold text-foreground"}>
          {item.title}
        </h3>
        <p className={compact ? "mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground/75" : "mt-2 whitespace-pre-wrap text-[15px] leading-7 text-foreground/75"}>
          {item.body}
        </p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {item.author} · {formatDate(item.createdAt)}
        </p>
      </div>
      {actions}
    </article>
  )
}

export function Noticeboard({
  initialItems,
  canManage,
  author,
  compact = false,
}: {
  initialItems: NoticeboardItem[]
  canManage: boolean
  author: string
  compact?: boolean
}) {
  const [items, setItems] = useState(() => recentItems(initialItems))
  const [editing, setEditing] = useState<NoticeboardItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const orderedItems = useMemo(
    () =>
      recentItems(items).sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  )
  const carouselItems = orderedItems.slice(0, 4)
  const current = carouselItems[active % Math.max(carouselItems.length, 1)]

  useEffect(() => {
    if (paused || editing || carouselItems.length < 2) return
    const id = window.setInterval(() => {
      setActive((value) => (value + 1) % carouselItems.length)
    }, 5500)
    return () => window.clearInterval(id)
  }, [carouselItems.length, editing, paused])

  function startNew() {
    setEditing({
      id: crypto.randomUUID(),
      title: "",
      body: "",
      author,
      createdAt: new Date().toISOString(),
      pinned: false,
    })
  }

  async function persist(nextItems: NoticeboardItem[]) {
    setSaving(true)
    try {
      const next = recentItems(nextItems)
      const response = await fetch("/api/dashboard/noticeboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next }),
      })
      if (!response.ok) throw new Error()
      setItems(next)
      setEditing(null)
      setActive(0)
      toast.success("Bacheca aggiornata")
    } catch {
      toast.error("Salvataggio della bacheca non riuscito")
    } finally {
      setSaving(false)
    }
  }

  function saveEditing() {
    if (!editing?.title.trim() || !editing.body.trim()) {
      toast.error("Inserisci titolo e comunicazione")
      return
    }
    const next = items.some((item) => item.id === editing.id)
      ? items.map((item) => (item.id === editing.id ? editing : item))
      : [editing, ...items]
    void persist(next)
  }

  function shift(direction: -1 | 1) {
    if (carouselItems.length < 2) return
    setActive((value) => (value + direction + carouselItems.length) % carouselItems.length)
  }

  const manageActions = current && canManage ? (
    <div className="flex gap-1 self-start opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Modifica comunicazione"
        onClick={() => setEditing(current)}
      >
        <Pencil />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Elimina comunicazione"
        onClick={() => void persist(items.filter((entry) => entry.id !== current.id))}
      >
        <Trash2 />
      </Button>
    </div>
  ) : null

  return (
    <section
      className={compact ? "dashboard-noticeboard dashboard-noticeboard--compact" : "dashboard-noticeboard"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={compact ? "flex size-10 items-center justify-center rounded-lg bg-[#fff1d6] text-[#a85e00]" : "flex size-12 items-center justify-center rounded-xl bg-[#fff1d6] text-[#a85e00]"}>
            <Megaphone className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[#a85e00]">Comunicazioni</p>
            <h2 className={compact ? "mt-1 text-xl font-bold text-foreground" : "mt-1 text-2xl font-bold text-foreground"}>Bacheca aziendale</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={
              <Button variant="outline" size={compact ? "default" : "lg"}>
                <History data-icon="inline-start" />
                Vedi tutti
              </Button>
            } />
            <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Storico bacheca</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                {orderedItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/25 px-6 py-8 text-center text-sm text-muted-foreground">
                    Nessuna comunicazione negli ultimi 3 mesi.
                  </p>
                ) : (
                  orderedItems.map((item) => (
                    <NoticeArticle key={item.id} item={item} compact={false} />
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          {canManage && !editing ? (
            <Button size={compact ? "default" : "lg"} onClick={startNew} className="shadow-sm">
              <Plus data-icon="inline-start" />
              {compact ? "Nuova nota" : "Nuova comunicazione"}
            </Button>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {editing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <div className="grid gap-4 rounded-lg border border-[#f0c66e] bg-white/80 p-5">
              <Input
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                placeholder="Titolo della comunicazione"
                className="h-12 bg-white text-base font-semibold"
              />
              <Textarea
                value={editing.body}
                onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                placeholder="Scrivi l'aggiornamento per il team..."
                className="min-h-28 bg-white text-base leading-7"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={editing.pinned}
                    onChange={(event) =>
                      setEditing({ ...editing, pinned: event.target.checked })
                    }
                    className="size-4 accent-primary"
                  />
                  Fissa in evidenza
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    <X data-icon="inline-start" />
                    Annulla
                  </Button>
                  <Button onClick={saveEditing} disabled={saving}>
                    <Save data-icon="inline-start" />
                    {saving ? "Salvataggio..." : "Pubblica"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-5">
        {carouselItems.length === 0 || !current ? (
          <div className="rounded-lg border border-dashed border-[#d9b66f] bg-white/50 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">Nessuna comunicazione</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gli aggiornamenti aziendali pubblicati appariranno qui.
            </p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.22 }}
              >
                <NoticeArticle item={current} compact={compact} actions={manageActions} />
              </motion.div>
            </AnimatePresence>
            {carouselItems.length > 1 ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex gap-1">
                  {carouselItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`h-2 rounded-full transition-all ${index === active ? "w-6 bg-[#a85e00]" : "w-2 bg-[#d8bb72]"}`}
                      aria-label={`Mostra comunicazione ${index + 1}`}
                      onClick={() => setActive(index)}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Comunicazione precedente" onClick={() => shift(-1)}>
                    <ChevronLeft />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Comunicazione successiva" onClick={() => shift(1)}>
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
