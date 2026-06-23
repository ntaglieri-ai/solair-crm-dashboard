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
  IconArrowsExchange,
  IconCalendarTime,
  IconCopyOff,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"
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
import {
  type Scadenza,
  mockProprietariScadenza,
} from "@/lib/mock-data"
import type { ScadenzaSettingsSectionId } from "./scadenza-settings-sheet"

type Dialogs =
  | "none"
  | "compose"
  | "drafts"
  | "fullscreen"
  | "transfer"
  | "update"
  | "dedup"

const MOCK_DRAFTS = [
  {
    id: "d1",
    subject: "Promemoria scadenza pratica",
    snippet: "Gentile cliente, le ricordiamo la scadenza imminente…",
    updated: "Ieri, 16:20",
  },
  {
    id: "d2",
    subject: "Rinnovo documentazione",
    snippet: "Buongiorno, la scadenza per il rinnovo si avvicina…",
    updated: "10 giu, 11:05",
  },
]

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

export function ScadenzaActionsMenu({
  selectedCount,
  filtered,
  selectedRows,
  onOpenSettings,
  onImport,
  onExportFiltered,
  onExportSelection,
  onBulkTransfer,
  onBulkUpdateDate,
  onBulkDedup,
  onBulkDelete,
}: {
  selectedCount: number
  filtered: Scadenza[]
  selectedRows: Scadenza[]
  onOpenSettings: (section: ScadenzaSettingsSectionId) => void
  onImport: () => void
  onExportFiltered: () => void
  onExportSelection: () => void
  onBulkTransfer: (owner: string) => void
  onBulkUpdateDate: (date: string) => void
  onBulkDedup: (idsToRemove: string[]) => void
  onBulkDelete: () => void
}) {
  const [dialog, setDialog] = useState<Dialogs>("none")
  const hasSelection = selectedCount > 0

  const [owner, setOwner] = useState(mockProprietariScadenza[0])
  const [newDate, setNewDate] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [keepers, setKeepers] = useState<Record<string, string>>({})

  // Gruppi duplicati tra le scadenze selezionate (per nome scadenza).
  const dupGroups = useMemo(() => {
    const map = new Map<string, Scadenza[]>()
    for (const s of selectedRows) {
      const key = norm(s["Nome Scadenze"])
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    const groups: { key: string; rows: Scadenza[] }[] = []
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
    setNewDate("")
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
      g.rows.forEach((s) => {
        if (s.id !== keep) remove.push(s.id)
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
            /* ---------------- Stato: righe selezionate ---------------- */
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {selectedCount} selezionate
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setDialog("transfer")}>
                  <IconArrowsExchange size={16} stroke={1.8} data-icon="inline-start" />
                  Trasferimento di massa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openUpdate}>
                  <IconCalendarTime size={16} stroke={1.8} data-icon="inline-start" />
                  Aggiornamento di massa
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={openDedup}>
                  <IconCopyOff size={16} stroke={1.8} data-icon="inline-start" />
                  De-duplica scadenze
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportSelection}>
                  <IconDownload size={16} stroke={1.8} data-icon="inline-start" />
                  Esporta selezione
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={onBulkDelete}>
                  <IconTrash size={16} stroke={1.8} data-icon="inline-start" />
                  Eliminazione di massa
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : (
            /* ---------------- Stato: azioni generali ---------------- */
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
                  Esporta scadenze
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

      {/* -------------------- Dialog: Invia Email -------------------- */}
      <Dialog
        open={dialog === "compose"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invia email per le scadenze filtrate</DialogTitle>
            <DialogDescription>
              Il messaggio verrà inviato ai referenti delle{" "}
              <span className="font-semibold text-foreground">
                {filtered.length} scadenze
              </span>{" "}
              attualmente filtrate.
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
                  description: `Invio per ${filtered.length} scadenze avviato.`,
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

      {/* -------------------- Dialog: Bozze -------------------- */}
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

      {/* -------------------- Dialog: Vista tabellare avanzata -------------------- */}
      <Dialog
        open={dialog === "fullscreen"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[96vw] flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Vista tabellare avanzata</DialogTitle>
            <DialogDescription>
              {filtered.length} scadenze — visualizzazione foglio a schermo
              intero.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-left">
                <tr className="border-b border-border">
                  {["Nome Scadenze", "Data scadenza", "Proprietario di Scadenze", "Connesso a", "Ora modifica"].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap border-r border-border/60 px-3 py-2 font-semibold text-muted-foreground last:border-r-0"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 hover:bg-secondary/40"
                  >
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 font-medium text-foreground">
                      {s["Nome Scadenze"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {s["Data scadenza"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {s["Proprietario di Scadenze"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {s["Connesso a"]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {s["Ora modifica"]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------- Dialog: Trasferimento di massa -------------------- */}
      <Dialog
        open={dialog === "transfer"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trasferimento di massa</DialogTitle>
            <DialogDescription>
              Assegna le {selectedCount} scadenze selezionate a un nuovo
              proprietario.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label>Nuovo Proprietario di Scadenze</Label>
            <Select value={owner} onValueChange={(v) => setOwner(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockProprietariScadenza.map((c) => (
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

      {/* -------------------- Dialog: Aggiornamento di massa -------------------- */}
      <Dialog
        open={dialog === "update"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiornamento di massa</DialogTitle>
            <DialogDescription>
              Imposta una nuova data di scadenza sulle {selectedCount} scadenze
              selezionate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label htmlFor="bulk-date">Nuova data scadenza</Label>
            <Input
              id="bulk-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button
              disabled={!newDate}
              onClick={() => {
                onBulkUpdateDate(newDate)
                setDialog("none")
              }}
            >
              Aggiorna {selectedCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Dialog: De-duplica -------------------- */}
      <Dialog
        open={dialog === "dedup"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>De-duplica scadenze</DialogTitle>
            <DialogDescription>
              {dupGroups.length === 0
                ? "Nessun duplicato rilevato tra le scadenze selezionate."
                : "Per ogni gruppo scegli il record da mantenere: gli altri verranno rimossi."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[50vh] flex-col gap-3 overflow-auto py-1">
            {dupGroups.map((g) => (
              <div
                key={g.key}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.rows.length} duplicati
                </span>
                {g.rows.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <input
                      type="radio"
                      name={`dedup-${g.key}`}
                      checked={(keepers[g.key] ?? g.rows[0].id) === s.id}
                      onChange={() =>
                        setKeepers((prev) => ({ ...prev, [g.key]: s.id }))
                      }
                    />
                    <span className="truncate text-foreground">
                      {s["Nome Scadenze"]}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {s["Data scadenza"]}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button disabled={dupGroups.length === 0} onClick={confirmDedup}>
              Unisci duplicati
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
