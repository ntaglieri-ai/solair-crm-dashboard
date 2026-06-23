"use client"

import { useMemo, useState } from "react"
import {
  IconDotsVertical,
  IconTags,
  IconRoute,
  IconMail,
  IconFileText,
  IconDownload,
  IconTable,
  IconPrinter,
  IconFileImport,
  IconCopyCheck,
  IconArrowsExchange,
  IconPencil,
  IconCopyOff,
  IconTrash,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  type InstallatoreRecord,
  mockInstallatoreProprietari,
  INSTALLATORE_STATO_VALUES,
} from "@/lib/mock-data"
import type { InstallatoreSettingsSectionId } from "./installatore-settings-sheet"

type Dialogs =
  | "none"
  | "compose"
  | "drafts"
  | "fullscreen"
  | "transfer"
  | "update"
  | "dedup"
  | "delete"

type UpdateField = "Stato" | "Tag"

const MOCK_DRAFTS = [
  {
    id: "d1",
    subject: "Aggiornamento convenzione installatori",
    snippet: "Gentile partner, le confermiamo i nuovi termini di collaborazione…",
    updated: "Ieri, 17:42",
  },
  {
    id: "d2",
    subject: "Richiesta documentazione certificazioni",
    snippet: "Buongiorno, le ricordiamo di inviare le certificazioni aggiornate…",
    updated: "12 giu, 09:15",
  },
]

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

export function InstallatoreActionsMenu({
  selectedCount,
  filtered,
  selectedRows,
  tags,
  onOpenSettings,
  onCheckDuplicates,
  onImport,
  onExportFiltered,
  onExportSelection,
  onBulkTransfer,
  onBulkUpdate,
  onBulkDedup,
  onBulkDelete,
}: {
  selectedCount: number
  filtered: InstallatoreRecord[]
  selectedRows: InstallatoreRecord[]
  tags: string[]
  onOpenSettings: (section: InstallatoreSettingsSectionId) => void
  onCheckDuplicates: () => void
  onImport: () => void
  onExportFiltered: () => void
  onExportSelection: () => void
  onBulkTransfer: (owner: string) => void
  onBulkUpdate: (field: UpdateField, value: string) => void
  onBulkDedup: (idsToRemove: string[]) => void
  onBulkDelete: () => void
}) {
  const [dialog, setDialog] = useState<Dialogs>("none")
  const hasSelection = selectedCount > 0

  const [owner, setOwner] = useState(mockInstallatoreProprietari[0])
  const [updField, setUpdField] = useState<UpdateField>("Stato")
  const [updValue, setUpdValue] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [keepers, setKeepers] = useState<Record<string, string>>({})

  const updValueOptions =
    updField === "Stato" ? (INSTALLATORE_STATO_VALUES as string[]) : tags

  // Gruppi duplicati tra gli installatori selezionati (per email)
  const dupGroups = useMemo(() => {
    const map = new Map<string, InstallatoreRecord[]>()
    for (const c of selectedRows) {
      const key = norm(c["E-mail"])
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(c)
      map.set(key, arr)
    }
    const groups: { key: string; rows: InstallatoreRecord[] }[] = []
    for (const [key, arr] of map) {
      if (arr.length < 2) continue
      groups.push({ key, rows: arr })
    }
    return groups
  }, [selectedRows])

  const openCompose = () => {
    setSubject("")
    setBody("")
    setDialog("compose")
  }

  const openUpdate = () => {
    setUpdField("Stato")
    setUpdValue("")
    setDialog("update")
  }

  const openDedup = () => {
    const init: Record<string, string> = {}
    for (const g of dupGroups) init[g.key] = g.rows[0].id
    setKeepers(init)
    setDialog("dedup")
  }

  const confirmDedup = () => {
    const remove: string[] = []
    for (const g of dupGroups) {
      const keep = keepers[g.key] ?? g.rows[0].id
      g.rows.forEach((l) => {
        if (l.id !== keep) remove.push(l.id)
      })
    }
    onBulkDedup(Array.from(new Set(remove)))
    setDialog("none")
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Azioni"
              className="relative bg-card"
            >
              <IconDotsVertical size={18} stroke={1.8} />
              {hasSelection ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-bold leading-none text-navy-foreground tabular-nums">
                  {selectedCount}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64">
          {hasSelection ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {selectedCount} selezionati
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setDialog("transfer")}>
                  <IconArrowsExchange size={16} stroke={1.8} data-icon="inline-start" />
                  Trasferimento di massa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openUpdate}>
                  <IconPencil size={16} stroke={1.8} data-icon="inline-start" />
                  Aggiornamento di massa
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={openDedup}>
                  <IconCopyOff size={16} stroke={1.8} data-icon="inline-start" />
                  De-duplica installatori
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportSelection}>
                  <IconDownload size={16} stroke={1.8} data-icon="inline-start" />
                  Esporta selezione
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDialog("delete")}
                >
                  <IconTrash size={16} stroke={1.8} data-icon="inline-start" />
                  Eliminazione di massa
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Gestione</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onOpenSettings("tag")}>
                  <IconTags size={16} stroke={1.8} data-icon="inline-start" />
                  Gestisci tag
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenSettings("regole")}>
                  <IconRoute size={16} stroke={1.8} data-icon="inline-start" />
                  Regole di assegnazione
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCheckDuplicates}>
                  <IconCopyCheck size={16} stroke={1.8} data-icon="inline-start" />
                  Controlla duplicati
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Comunicazioni</DropdownMenuLabel>
                <DropdownMenuItem onClick={openCompose}>
                  <IconMail size={16} stroke={1.8} data-icon="inline-start" />
                  Invia Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog("drafts")}>
                  <IconFileText size={16} stroke={1.8} data-icon="inline-start" />
                  Bozze
                  <span className="ml-auto rounded-full bg-secondary px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {MOCK_DRAFTS.length}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Dati e vista</DropdownMenuLabel>
                <DropdownMenuItem onClick={onExportFiltered}>
                  <IconDownload size={16} stroke={1.8} data-icon="inline-start" />
                  Esporta installatori
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onImport}>
                  <IconFileImport size={16} stroke={1.8} data-icon="inline-start" />
                  Importa…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog("fullscreen")}>
                  <IconTable size={16} stroke={1.8} data-icon="inline-start" />
                  Vista tabellare avanzata
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconPrinter size={16} stroke={1.8} data-icon="inline-start" />
                    Stampa Vista
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        toast.success("Stampa avviata", {
                          description: "Vista corrente inviata in stampa.",
                        })
                        if (typeof window !== "undefined") window.print()
                      }}
                    >
                      Vista corrente
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        toast.success("Stampa avviata", {
                          description: "Vista compatta inviata in stampa.",
                        })
                        if (typeof window !== "undefined") window.print()
                      }}
                    >
                      Vista compatta
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog: Invia Email */}
      <Dialog
        open={dialog === "compose"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invia email agli installatori filtrati</DialogTitle>
            <DialogDescription>
              Il messaggio verrà inviato ai{" "}
              <span className="font-semibold text-foreground">
                {filtered.length} installatori
              </span>{" "}
              attualmente filtrati.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-subject">Oggetto</Label>
              <Input
                id="mail-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Oggetto dell'email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-body">Messaggio</Label>
              <Textarea
                id="mail-body"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Scrivi il contenuto dell'email…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button
              disabled={!subject.trim()}
              onClick={() => {
                toast.success("Email in invio", {
                  description: `Invio a ${filtered.length} installatori avviato.`,
                })
                setDialog("none")
              }}
            >
              <IconMail size={16} stroke={1.8} data-icon="inline-start" />
              Invia a {filtered.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Bozze */}
      <Dialog
        open={dialog === "drafts"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bozze email</DialogTitle>
            <DialogDescription>
              Riprendi una bozza salvata per continuare la composizione.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-1">
            {MOCK_DRAFTS.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <IconFileText
                  size={18}
                  stroke={1.8}
                  className="shrink-0 text-muted-foreground"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {d.subject}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {d.snippet}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {d.updated}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSubject(d.subject)
                    setBody(d.snippet)
                    setDialog("compose")
                  }}
                >
                  Riprendi
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vista tabellare avanzata */}
      <Dialog
        open={dialog === "fullscreen"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[96vw] flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Vista tabellare avanzata</DialogTitle>
            <DialogDescription>
              {filtered.length} installatori — visualizzazione foglio a schermo
              intero.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-left">
                <tr className="border-b border-border">
                  {[
                    "Nome Installatore",
                    "Stato",
                    "Proprietario di Installatore",
                    "Persona di riferimento",
                    "Cellulare",
                    "E-mail",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-r border-border/60 px-3 py-2 font-semibold text-muted-foreground last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/60 hover:bg-secondary/40"
                  >
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 font-medium text-foreground">
                      {c["Nome Installatore"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {c.Stato}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {c["Proprietario di Installatore"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {c["Persona di riferimento"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {c.Cellulare}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {c["E-mail"]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Trasferimento di massa */}
      <Dialog
        open={dialog === "transfer"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trasferimento di massa</DialogTitle>
            <DialogDescription>
              Assegna i {selectedCount} installatori selezionati a un nuovo
              proprietario.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label>Nuovo Proprietario di Installatore</Label>
            <Select value={owner} onValueChange={(v) => setOwner(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockInstallatoreProprietari.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                onBulkTransfer(owner)
                setDialog("none")
              }}
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Aggiornamento di massa */}
      <Dialog
        open={dialog === "update"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiornamento di massa</DialogTitle>
            <DialogDescription>
              Aggiorna un campo su tutti i {selectedCount} installatori
              selezionati.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Campo</Label>
              <Select
                value={updField}
                onValueChange={(v) => {
                  setUpdField((v ?? "Stato") as UpdateField)
                  setUpdValue("")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Stato">Stato</SelectItem>
                    <SelectItem value="Tag">Tag</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nuovo valore</Label>
              <Select value={updValue} onValueChange={(v) => setUpdValue(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {updValueOptions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button
              disabled={!updValue}
              onClick={() => {
                onBulkUpdate(updField, updValue)
                setDialog("none")
              }}
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: De-duplica */}
      <Dialog
        open={dialog === "dedup"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>De-duplica installatori</DialogTitle>
            <DialogDescription>
              {dupGroups.length > 0
                ? "Per ogni gruppo duplicato scegli il record da mantenere; gli altri verranno eliminati."
                : "Nessun duplicato rilevato tra gli installatori selezionati."}
            </DialogDescription>
          </DialogHeader>
          {dupGroups.length > 0 ? (
            <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto py-1">
              {dupGroups.map((g) => (
                <div
                  key={g.key}
                  className="flex flex-col gap-1 rounded-lg border border-border p-2"
                >
                  <span className="px-1 text-xs font-medium text-muted-foreground">
                    Corrispondenza: {g.key}
                  </span>
                  {g.rows.map((l) => (
                    <label
                      key={l.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary/60",
                        keepers[g.key] === l.id && "bg-secondary",
                      )}
                    >
                      <input
                        type="radio"
                        name={`dedup-${g.key}`}
                        checked={keepers[g.key] === l.id}
                        onChange={() =>
                          setKeepers((prev) => ({ ...prev, [g.key]: l.id }))
                        }
                        className="accent-navy"
                      />
                      <span className="flex-1 truncate font-medium text-foreground">
                        {l["Nome Installatore"]}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {l["E-mail"]}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button disabled={dupGroups.length === 0} onClick={confirmDedup}>
              Unisci e mantieni selezionati
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminazione di massa */}
      <Dialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Eliminazione di massa
            </DialogTitle>
            <DialogDescription className="text-destructive">
              Questa azione eliminerà {selectedCount} installatori. Non può
              essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onBulkDelete()
                setDialog("none")
              }}
            >
              Elimina {selectedCount} installatori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
