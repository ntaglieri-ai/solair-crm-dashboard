"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  IconFileText,
  IconPhoto,
  IconDownload,
  IconTrash,
  IconUpload,
  IconLink,
  IconPlus,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"

type DocumentoRow = {
  id: string
  nome_file: string
  dimensione_kb: number | null
  created_at: string
}
type CollegamentoRow = {
  id: string
  titolo: string
  url: string
  created_at: string
}

function formatSize(kb: number | null): string {
  if (!kb) return ""
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(iso))
}

function isImage(nomeFile: string): boolean {
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(nomeFile)
}

/**
 * Sezione allegati generica — mostra semplicemente cosa contiene la
 * cartella Nextcloud del record, senza slot/categorie speciali (decisione
 * esplicita 25/07: "deve essere semplicemente la visualizzazione di cio'
 * che la cartella contiene"). Riusabile su Lead/Cliente/Installatore.
 */
export function AllegatiSection({
  recordTipo,
  recordId,
  nomeRecord,
}: {
  recordTipo: AllegatoRecordTipo
  recordId: string
  nomeRecord: string
}) {
  const [documenti, setDocumenti] = useState<DocumentoRow[]>([])
  const [collegamenti, setCollegamenti] = useState<CollegamentoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTitolo, setLinkTitolo] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [savingLink, setSavingLink] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/allegati?recordTipo=${recordTipo}&recordId=${recordId}`,
        { cache: "no-store" },
      )
      if (!res.ok) throw new Error()
      const data = (await res.json()) as {
        documenti: DocumentoRow[]
        collegamenti: CollegamentoRow[]
      }
      setDocumenti(data.documenti)
      setCollegamenti(data.collegamenti)
    } catch {
      toast.error("Impossibile caricare gli allegati")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordTipo, recordId])

  async function handleFileSelected(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("recordTipo", recordTipo)
      formData.append("recordId", recordId)
      formData.append("nomeRecord", nomeRecord)
      const res = await fetch("/api/allegati", { method: "POST", body: formData })
      const result = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(result?.error ?? "Caricamento non riuscito")
      toast.success("File caricato")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Caricamento non riuscito")
    } finally {
      setUploading(false)
    }
  }

  async function handleAddLink() {
    setSavingLink(true)
    try {
      const res = await fetch("/api/allegati/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titolo: linkTitolo, url: linkUrl, recordTipo, recordId }),
      })
      const result = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(result?.error ?? "Salvataggio non riuscito")
      toast.success("Collegamento aggiunto")
      setLinkOpen(false)
      setLinkTitolo("")
      setLinkUrl("")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito")
    } finally {
      setSavingLink(false)
    }
  }

  async function handleDelete(id: string, tipo: "documento" | "collegamento") {
    try {
      const res = await fetch(`/api/allegati/${id}?tipo=${tipo}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(tipo === "documento" ? "File eliminato" : "Collegamento eliminato")
      await refresh()
    } catch {
      toast.error("Eliminazione non riuscita")
    }
  }

  const isEmpty = !loading && documenti.length === 0 && collegamenti.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
          Documenti
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="outline" className="bg-card" disabled={uploading}>
                <IconPlus size={15} stroke={1.8} data-icon="inline-start" />
                {uploading ? "Caricamento..." : "Allega"}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <IconUpload size={15} stroke={1.8} data-icon="inline-start" />
              Da computer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLinkOpen(true)}>
              <IconLink size={15} stroke={1.8} data-icon="inline-start" />
              Da URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFileSelected(file)
            event.target.value = ""
          }}
        />
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Caricamento...</p>
      ) : isEmpty ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/30 py-6 text-center text-sm text-muted-foreground">
          Nessun allegato
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documenti.map((doc) => {
            const Icon = isImage(doc.nome_file) ? IconPhoto : IconFileText
            return (
              <li
                key={doc.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
                  <Icon size={18} stroke={1.8} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {doc.nome_file}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatSize(doc.dimensione_kb)} · {formatDate(doc.created_at)}
                  </span>
                </div>
                <a
                  href={`/api/allegati/${doc.id}/download`}
                  aria-label="Scarica"
                  className="flex size-7 items-center justify-center rounded-md text-navy opacity-0 transition-all hover:bg-secondary group-hover:opacity-100"
                >
                  <IconDownload size={16} stroke={1.8} />
                </a>
                <button
                  type="button"
                  aria-label="Elimina"
                  onClick={() => handleDelete(doc.id, "documento")}
                  className="flex size-7 items-center justify-center rounded-md text-destructive opacity-0 transition-all hover:bg-destructive/10 group-hover:opacity-100"
                >
                  <IconTrash size={16} stroke={1.8} />
                </button>
              </li>
            )
          })}
          {collegamenti.map((link) => (
            <li
              key={link.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
                <IconLink size={18} stroke={1.8} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[13px] font-medium text-foreground hover:underline"
                >
                  {link.titolo}
                </a>
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(link.created_at)}
                </span>
              </div>
              <button
                type="button"
                aria-label="Elimina"
                onClick={() => handleDelete(link.id, "collegamento")}
                className="flex size-7 items-center justify-center rounded-md text-destructive opacity-0 transition-all hover:bg-destructive/10 group-hover:opacity-100"
              >
                <IconTrash size={16} stroke={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi collegamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-titolo">Titolo</Label>
              <Input
                id="link-titolo"
                value={linkTitolo}
                onChange={(e) => setLinkTitolo(e.target.value)}
                placeholder="Es. Preventivo fornitore"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={savingLink}>
              Annulla
            </Button>
            <Button
              onClick={handleAddLink}
              disabled={savingLink || !linkTitolo.trim() || !linkUrl.trim()}
            >
              {savingLink ? "Salvataggio..." : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
