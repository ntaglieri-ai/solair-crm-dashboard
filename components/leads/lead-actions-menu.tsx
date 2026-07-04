"use client"

import { useMemo, useState } from "react"
import {
  IconDotsVertical,
  IconMail,
  IconDownload,
  IconTable,
  IconPrinter,
  IconTags,
  IconCopyCheck,
  IconArrowsExchange,
  IconPencil,
  IconUserCheck,
  IconCopyOff,
  IconCircleCheck,
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
  type Lead,
  STATO_LEAD_ORDER,
  SEDE_LABELS,
} from "@/lib/mock-data"
import { useTags } from "@/lib/tag-store"
import type { SettingsSectionId } from "./lead-settings-sheet"
import { LeadTagSection } from "./lead-tag-section"

type Dialogs =
  | "none"
  | "tags"
  | "compose"
  | "fullscreen"
  | "transfer"
  | "update"
  | "convert"
  | "dedup"
  | "delete"

type UpdateField = "Stato Lead" | "Sede" | "Tag"

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

export function LeadActionsMenu({
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
  onBulkConvert,
  onBulkApprove,
  onBulkDedup,
  onBulkDelete,
}: {
  selectedCount: number
  filtered: Lead[]
  selectedRows: Lead[]
  tags: string[]
  onOpenSettings: (section: SettingsSectionId) => void
  onCheckDuplicates: () => void
  onImport: () => void
  onExportFiltered: () => void
  onExportSelection: () => void
  onBulkTransfer: (owner: string) => void
  onBulkUpdate: (field: UpdateField, value: string) => void
  onBulkConvert: () => void
  onBulkApprove: () => void
  onBulkDedup: (idsToRemove: string[]) => void
  onBulkDelete: () => void
}) {
  const { owners } = useTags()
  const [dialog, setDialog] = useState<Dialogs>("none")
  const hasSelection = selectedCount > 0

  // Form state
  const [owner, setOwner] = useState("")
  const [updField, setUpdField] = useState<UpdateField>("Stato Lead")
  const [updValue, setUpdValue] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [keepers, setKeepers] = useState<Record<string, string>>({})

  const updValueOptions =
    updField === "Stato Lead"
      ? (STATO_LEAD_ORDER as string[])
      : updField === "Sede"
        ? (SEDE_LABELS as string[])
        : tags

  // Coppie/gruppi duplicati tra i lead selezionati (per email o telefono)
  const dupGroups = useMemo(() => {
    const map = new Map<string, Lead[]>()
    for (const lead of selectedRows) {
      const keys = [norm(lead["E-mail"]), norm(lead.Telefono)].filter(Boolean)
      const seen = new Set<string>()
      for (const k of keys) {
        if (seen.has(k)) continue
        seen.add(k)
        const arr = map.get(k) ?? []
        arr.push(lead)
        map.set(k, arr)
      }
    }
    const groups: { key: string; leads: Lead[] }[] = []
    const used = new Set<string>()
    for (const [key, arr] of map) {
      if (arr.length < 2) continue
      const ids = arr.map((l) => l.id).join(",")
      if (used.has(ids)) continue
      used.add(ids)
      groups.push({ key, leads: arr })
    }
    return groups
  }, [selectedRows])

  const openCompose = () => {
    setSubject("")
    setBody("")
    setDialog("compose")
  }

  const openUpdate = () => {
    setUpdField("Stato Lead")
    setUpdValue("")
    setDialog("update")
  }

  const openDedup = () => {
    const init: Record<string, string> = {}
    for (const g of dupGroups) init[g.key] = g.leads[0].id
    setKeepers(init)
    setDialog("dedup")
  }

  const confirmDedup = () => {
    const remove: string[] = []
    for (const g of dupGroups) {
      const keep = keepers[g.key] ?? g.leads[0].id
      g.leads.forEach((l) => {
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
            /* ---------------- STATO B: righe selezionate ---------------- */
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
                <DropdownMenuItem onClick={() => setDialog("convert")}>
                  <IconUserCheck size={16} stroke={1.8} data-icon="inline-start" />
                  Converti in massa
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={openDedup}>
                  <IconCopyOff size={16} stroke={1.8} data-icon="inline-start" />
                  De-duplica Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBulkApprove}>
                  <IconCircleCheck size={16} stroke={1.8} data-icon="inline-start" />
                  Approva Lead
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
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
            /* ---------------- STATO A: azioni generali ---------------- */
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Gestione</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setDialog("tags")}>
                  <IconTags size={16} stroke={1.8} data-icon="inline-start" />
                  Gestisci tag
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
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Dati e vista</DropdownMenuLabel>
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

      {/* -------------------- Dialog: Gestisci tag -------------------- */}
      <Dialog
        open={dialog === "tags"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestisci tag</DialogTitle>
            <DialogDescription>
              Crea, rinomina, cambia colore o elimina i tag dei lead.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <LeadTagSection />
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------- Dialog: Invia Email -------------------- */}
      <Dialog
        open={dialog === "compose"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invia email ai lead filtrati</DialogTitle>
            <DialogDescription>
              Il messaggio verrà inviato ai{" "}
              <span className="font-semibold text-foreground">
                {filtered.length} lead
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
                  description: `Invio a ${filtered.length} lead avviato.`,
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

      {/* -------------------- Dialog: Vista tabellare avanzata -------------------- */}
      <Dialog
        open={dialog === "fullscreen"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[96vw] flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Vista tabellare avanzata</DialogTitle>
            <DialogDescription>
              {filtered.length} lead — visualizzazione foglio a schermo intero.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-left">
                <tr className="border-b border-border">
                  {["Nome Lead", "Stato Lead", "Sede", "Lead Proprietario", "Origine Lead", "Valutazione"].map(
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
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/60 hover:bg-secondary/40"
                  >
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 font-medium text-foreground">
                      {l["Nome Lead"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {l["Stato Lead"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {l.Sede}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {l["Lead Proprietario"]}
                    </td>
                    <td className="whitespace-nowrap border-r border-border/40 px-3 py-1.5 text-muted-foreground">
                      {l["Origine Lead"]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">
                      {l.Valutazione}
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
              Assegna i {selectedCount} lead selezionati a un nuovo proprietario.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label>Nuovo Lead Proprietario</Label>
            <Select value={owner} onValueChange={(next) => setOwner(next ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {owners.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.nome}
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
              Aggiorna un campo su tutti i {selectedCount} lead selezionati.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Campo</Label>
              <Select
                value={updField}
                onValueChange={(v) => {
                  setUpdField(v as UpdateField)
                  setUpdValue("")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Stato Lead">Stato Lead</SelectItem>
                    <SelectItem value="Sede">Sede</SelectItem>
                    <SelectItem value="Tag">Tag</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nuovo valore</Label>
              <Select
                value={updValue}
                onValueChange={(next) => setUpdValue(next ?? "")}
              >
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

      {/* -------------------- Dialog: Converti in massa -------------------- */}
      <Dialog
        open={dialog === "convert"}
        onOpenChange={(o) => !o && setDialog("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti in massa</DialogTitle>
            <DialogDescription>
              Convertire{" "}
              <span className="font-semibold text-foreground">
                {selectedCount} lead
              </span>{" "}
              in clienti? Verranno create le relative schede cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => {
                onBulkConvert()
                setDialog("none")
              }}
            >
              Converti {selectedCount}
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
            <DialogTitle>De-duplica lead</DialogTitle>
            <DialogDescription>
              {dupGroups.length > 0
                ? "Per ogni gruppo duplicato scegli il record da mantenere; gli altri verranno eliminati."
                : "Nessun duplicato rilevato tra i lead selezionati."}
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
                  {g.leads.map((l) => (
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
                        {l["Nome Lead"]}
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

      {/* -------------------- Dialog: Eliminazione di massa -------------------- */}
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
              Questa azione eliminerà {selectedCount} lead. Non può essere
              annullata.
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
              Elimina {selectedCount} lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
