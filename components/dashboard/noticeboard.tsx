"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Megaphone, Pencil, Pin, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
  const [items, setItems] = useState(initialItems)
  const [editing, setEditing] = useState<NoticeboardItem | null>(null)
  const [saving, setSaving] = useState(false)
  const orderedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  )

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

  async function persist(next: NoticeboardItem[]) {
    setSaving(true)
    try {
      const response = await fetch("/api/dashboard/noticeboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next }),
      })
      if (!response.ok) throw new Error()
      setItems(next)
      setEditing(null)
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

  return (
    <section className={compact ? "dashboard-noticeboard dashboard-noticeboard--compact" : "dashboard-noticeboard"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={compact ? "flex size-10 items-center justify-center rounded-lg bg-[#fff1d6] text-[#a85e00]" : "flex size-12 items-center justify-center rounded-xl bg-[#fff1d6] text-[#a85e00]"}>
            <Megaphone className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a85e00]">
              Comunicazioni
            </p>
            <h2 className={compact ? "mt-1 text-xl font-bold text-foreground" : "mt-1 text-2xl font-bold text-foreground"}>Bacheca aziendale</h2>
          </div>
        </div>
        {canManage && !editing ? (
          <Button size={compact ? "default" : "lg"} onClick={startNew} className="shadow-sm">
            <Plus data-icon="inline-start" />
            {compact ? "Nuova nota" : "Nuova comunicazione"}
          </Button>
        ) : null}
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

      <div className={compact ? "noticeboard-scroll mt-4 grid gap-3 overflow-y-auto pr-1" : "mt-6 grid gap-3"}>
        {orderedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d9b66f] bg-white/50 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">Nessuna comunicazione</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gli aggiornamenti aziendali pubblicati appariranno qui.
            </p>
          </div>
        ) : (
          orderedItems.slice(0, 4).map((item, index) => (
            <motion.article
              layout
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={compact
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
                <h3 className={compact ? "text-base font-bold text-foreground" : "text-lg font-bold text-foreground"}>{item.title}</h3>
                <p className={compact ? "mt-1.5 whitespace-pre-wrap text-sm leading-5 text-foreground/75" : "mt-2 whitespace-pre-wrap text-[15px] leading-6 text-foreground/75"}>
                  {item.body}
                </p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  {item.author} · {formatDate(item.createdAt)}
                </p>
              </div>
              {canManage ? (
                <div className="flex gap-1 self-start opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Modifica comunicazione"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Elimina comunicazione"
                    onClick={() => void persist(items.filter((entry) => entry.id !== item.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </motion.article>
          ))
        )}
      </div>
    </section>
  )
}
