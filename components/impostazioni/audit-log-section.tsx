"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockAuditLog,
  AUDIT_MODULI,
  AUDIT_AZIONE_LABEL,
  AUDIT_AZIONE_TONE,
  type AuditAzione,
} from "@/lib/mock-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

const PAGE_SIZE = 30
const AZIONI: AuditAzione[] = ["insert", "update", "delete"]

const AZIONE_TONE_CLASS: Record<"success" | "info" | "destructive", string> = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
}

export function AuditLogSection() {
  const [utente, setUtente] = useState("all")
  const [modulo, setModulo] = useState("all")
  const [azione, setAzione] = useState("all")
  const [page, setPage] = useState(1)

  const utenti = useMemo(() => {
    const names = new Set(mockAuditLog.map((e) => e.utente))
    return Array.from(names)
  }, [])

  const filtered = useMemo(() => {
    return mockAuditLog.filter((e) => {
      if (utente !== "all" && e.utente !== utente) return false
      if (modulo !== "all" && e.modulo !== modulo) return false
      if (azione !== "all" && e.azione !== azione) return false
      return true
    })
  }, [utente, modulo, azione])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)

  const resetPage = () => setPage(1)

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Audit log"
        description="Registro immutabile degli eventi di sistema. I record non possono essere modificati."
      />

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={utente}
          onValueChange={(v) => {
            setUtente(v ?? "all")
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Tutti gli utenti" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Tutti gli utenti</SelectItem>
              {utenti.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={modulo}
          onValueChange={(v) => {
            setModulo(v ?? "all")
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Tutti i moduli" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Tutti i moduli</SelectItem>
              {AUDIT_MODULI.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={azione}
          onValueChange={(v) => {
            setAzione(v ?? "all")
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Tutte le azioni" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Tutte le azioni</SelectItem>
              {AZIONI.map((a) => (
                <SelectItem key={a} value={a}>
                  {AUDIT_AZIONE_LABEL[a]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {(utente !== "all" || modulo !== "all" || azione !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUtente("all")
              setModulo("all")
              setAzione("all")
              resetPage()
            }}
          >
            Reset filtri
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-muted-foreground">
                  Timestamp
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Utente
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Azione
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Modulo
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Record
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Dettaglio
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nessun evento corrisponde ai filtri selezionati.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                      {e.timestamp}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                      {e.utente}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                          AZIONE_TONE_CLASS[AUDIT_AZIONE_TONE[e.azione]],
                        )}
                      >
                        {AUDIT_AZIONE_LABEL[e.azione]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {e.modulo}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {e.record}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.dettaglio}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Paginazione */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {filtered.length} event{filtered.length === 1 ? "o" : "i"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8 bg-card"
            aria-label="Pagina precedente"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-1 tabular-nums">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8 bg-card"
            aria-label="Pagina successiva"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
