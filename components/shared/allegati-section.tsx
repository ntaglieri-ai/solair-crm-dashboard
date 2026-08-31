"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  IconFileText,
  IconFolder,
  IconFolderPlus,
  IconPhoto,
  IconDownload,
  IconTrash,
  IconUpload,
  IconLink,
  IconPlus,
  IconExternalLink,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { NextcloudOpenLink } from "@/components/nextcloud/nextcloud-open-link"
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
import { NomeDocumentoDialog } from "@/components/shared/nome-documento-dialog"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"
// Stessa route deep-link (OIDC) usata dal modulo Documenti: il path viene
// validato server-side contro path-permissions.ts.
import { openNextcloudUrl } from "@/lib/documenti-data"

// Voce reale della cartella Nextcloud del record: niente id DB, il path e'
// l'identificatore (chiave React, download, delete, apertura sottocartella).
type DocumentoRow = {
  nome: string
  isFolder: boolean
  dimensioneKb: number | null
  modificato: string | null
  path: string
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
 * che la cartella contiene"). Dal 27/07 Nextcloud e' l'UNICA fonte per i
 * file: il contenuto arriva live dalla cartella, non dalla tabella
 * `documenti`. I collegamenti (link esterni) restano DB-backed.
 * Riusabile su Lead/Cliente/Installatore.
 */
export function AllegatiSection({
  recordTipo,
  recordId,
  nomeRecord,
  sottocartella,
  titolo = "Documenti",
  onChanged,
  cognomeConvenzione,
}: {
  recordTipo: AllegatoRecordTipo
  recordId: string
  nomeRecord: string
  /**
   * Punta la sezione a una sottocartella della cartella record invece che
   * alla radice (usata dai "Documenti obbligatori" del Lead). In questa
   * modalita' si carica e basta: niente sottocartelle annidate e niente
   * collegamenti, che sono legati al record e restano nella sezione
   * principale.
   */
  sottocartella?: string
  titolo?: string
  /** Notifica il chiamante dopo ogni modifica reale (upload/eliminazione). */
  onChanged?: () => void
  /**
   * Attiva il dialog che propone il nome secondo la convenzione della spec
   * 5.3 ({TipoDocumento}_{Cognome}_{AAAAMMGG}) prima di caricare. Opt-in per
   * decisione esplicita: vale solo per gli allegati generici del Cliente —
   * i Lead e la sottocartella "Documenti obbligatori" (1.3) hanno regole
   * proprie e continuano a caricare col nome originale del file.
   */
  cognomeConvenzione?: string
}) {
  const [documenti, setDocumenti] = useState<DocumentoRow[]>([])
  const [collegamenti, setCollegamenti] = useState<CollegamentoRow[]>([])
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTitolo, setLinkTitolo] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [savingLink, setSavingLink] = useState(false)
  const [cartellaOpen, setCartellaOpen] = useState(false)
  const [nomeCartella, setNomeCartella] = useState("")
  const [savingCartella, setSavingCartella] = useState(false)
  // File scelto e in attesa che l'agente confermi il nome (solo quando la
  // convenzione e' attiva); null quando non c'e' nessun dialog aperto.
  const [fileDaNominare, setFileDaNominare] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modalita' sottocartella: solo file, nessuna cartella annidata e nessun
  // collegamento (vedi commento sul prop).
  const soloFile = Boolean(sottocartella)

  const recordQuery =
    `recordTipo=${encodeURIComponent(recordTipo)}` +
    `&recordId=${encodeURIComponent(recordId)}` +
    `&nomeRecord=${encodeURIComponent(nomeRecord)}` +
    (sottocartella ? `&sottocartella=${encodeURIComponent(sottocartella)}` : "")

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(`/api/allegati?${recordQuery}`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as {
        folderPath: string
        documenti: DocumentoRow[]
        collegamenti: CollegamentoRow[]
      }
      setFolderPath(data.folderPath)
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
  }, [recordTipo, recordId, nomeRecord, sottocartella])

  /**
   * Con la convenzione attiva il file non parte subito: si apre il dialog che
   * propone il nome. Senza convenzione resta il comportamento di sempre,
   * upload immediato col nome originale.
   */
  function handleFileSelected(file: File) {
    if (cognomeConvenzione === undefined) {
      uploadFile(file)
      return
    }
    setFileDaNominare(file)
  }

  async function uploadFile(file: File, nomeFile?: string) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("recordTipo", recordTipo)
      formData.append("recordId", recordId)
      formData.append("nomeRecord", nomeRecord)
      if (sottocartella) formData.append("sottocartella", sottocartella)
      // Il nome scelto nel dialog viaggia a parte: il File originale resta
      // intatto, cosi' il nome di partenza e' ancora leggibile lato server se
      // dovesse servire per un errore.
      if (nomeFile) formData.append("nomeFile", nomeFile)
      const res = await fetch("/api/allegati", { method: "POST", body: formData })
      const result = (await res.json().catch(() => null)) as {
        path?: string
        error?: string
      } | null
      if (!res.ok) throw new Error(result?.error ?? "Caricamento non riuscito")
      // Il nome definitivo lo decide il server sul contenuto reale della
      // cartella: se qualcun altro ha caricato lo stesso nome dopo l'ultimo
      // refresh, il progressivo che vede l'utente non e' quello finito su
      // Nextcloud, e va detto invece di lasciarlo scoprire dalla lista.
      const nomeCaricato = result?.path?.split("/").pop()
      toast.success(
        "File caricato",
        nomeFile && nomeCaricato && nomeCaricato !== nomeFile
          ? { description: `Salvato come ${nomeCaricato}` }
          : undefined,
      )
      setFileDaNominare(null)
      await refresh()
      onChanged?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Caricamento non riuscito")
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateFolder() {
    setSavingCartella(true)
    try {
      const res = await fetch("/api/allegati", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordTipo, recordId, nomeRecord, nuovaCartella: nomeCartella }),
      })
      const result = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(result?.error ?? "Creazione non riuscita")
      toast.success("Cartella creata")
      setCartellaOpen(false)
      setNomeCartella("")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creazione non riuscita")
    } finally {
      setSavingCartella(false)
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

  async function handleDeleteDocumento(doc: DocumentoRow) {
    try {
      const res = await fetch(
        `/api/allegati/file?tipo=documento&path=${encodeURIComponent(doc.path)}&${recordQuery}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error()
      toast.success(doc.isFolder ? "Cartella eliminata" : "File eliminato")
      await refresh()
      onChanged?.()
    } catch {
      toast.error("Eliminazione non riuscita")
    }
  }

  async function handleDeleteCollegamento(id: string) {
    try {
      const res = await fetch(`/api/allegati/${id}?tipo=collegamento`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Collegamento eliminato")
      await refresh()
    } catch {
      toast.error("Eliminazione non riuscita")
    }
  }

  const isEmpty = !loading && documenti.length === 0 && collegamenti.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
          {titolo}
        </span>
        <div className="flex items-center gap-1.5">
          {folderPath ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-navy"
              nativeButton={false}
              render={
                <NextcloudOpenLink href={openNextcloudUrl(folderPath)} />
              }
            >
              <IconExternalLink size={15} stroke={1.8} data-icon="inline-start" />
              Apri in Nextcloud
            </Button>
          ) : null}
          {soloFile ? null : (
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={() => setCartellaOpen(true)}
            >
              <IconFolderPlus size={15} stroke={1.8} data-icon="inline-start" />
              Nuova cartella
            </Button>
          )}
          {soloFile ? (
            // Un solo modo di aggiungere: caricare un file. Senza menu a
            // tendina, cosi' il gesto giusto e' anche l'unico disponibile.
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload size={15} stroke={1.8} data-icon="inline-start" />
              {uploading ? "Caricamento..." : "Carica documento"}
            </Button>
          ) : (
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
          )}
        </div>
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
          {soloFile ? "Nessun documento caricato" : "Nessun allegato"}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documenti.map((doc) => {
            const Icon = doc.isFolder ? IconFolder : isImage(doc.nome) ? IconPhoto : IconFileText
            const meta = [
              doc.isFolder ? "Cartella" : formatSize(doc.dimensioneKb),
              doc.modificato ? formatDate(doc.modificato) : "",
            ]
              .filter(Boolean)
              .join(" · ")
            return (
              <li
                key={doc.path}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
                  <Icon size={18} stroke={1.8} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  {doc.isFolder ? (
                    // Le sottocartelle si aprono direttamente su Nextcloud.
                    <NextcloudOpenLink
                      href={openNextcloudUrl(doc.path)}
                      className="truncate text-[13px] font-medium text-foreground hover:underline"
                    >
                      {doc.nome}
                    </NextcloudOpenLink>
                  ) : (
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {doc.nome}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{meta}</span>
                </div>
                {doc.isFolder ? null : (
                  <a
                    href={`/api/allegati/file/download?path=${encodeURIComponent(doc.path)}&${recordQuery}`}
                    aria-label="Scarica"
                    className="flex size-7 items-center justify-center rounded-md text-navy opacity-0 transition-all hover:bg-secondary group-hover:opacity-100"
                  >
                    <IconDownload size={16} stroke={1.8} />
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Elimina"
                  onClick={() => handleDeleteDocumento(doc)}
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
                onClick={() => handleDeleteCollegamento(link.id)}
                className="flex size-7 items-center justify-center rounded-md text-destructive opacity-0 transition-all hover:bg-destructive/10 group-hover:opacity-100"
              >
                <IconTrash size={16} stroke={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={cartellaOpen} onOpenChange={setCartellaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova cartella</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label htmlFor="cartella-nome">Nome cartella</Label>
            <Input
              id="cartella-nome"
              value={nomeCartella}
              onChange={(e) => setNomeCartella(e.target.value)}
              placeholder="Es. Documenti tecnici"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCartellaOpen(false)}
              disabled={savingCartella}
            >
              Annulla
            </Button>
            <Button onClick={handleCreateFolder} disabled={savingCartella || !nomeCartella.trim()}>
              {savingCartella ? "Creazione..." : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <NomeDocumentoDialog
        file={fileDaNominare}
        cognome={cognomeConvenzione ?? ""}
        // Anche le cartelle: un PUT sul path di una cartella esistente non
        // crea un file, fallisce.
        nomiEsistenti={documenti.map((doc) => doc.nome)}
        uploading={uploading}
        onConfirm={(nomeFile) => {
          if (fileDaNominare) uploadFile(fileDaNominare, nomeFile)
        }}
        onCancel={() => setFileDaNominare(null)}
      />
    </div>
  )
}
