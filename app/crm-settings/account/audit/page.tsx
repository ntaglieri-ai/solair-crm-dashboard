"use client"

import { useMemo, useState } from "react"
import {
  LogIn,
  FileEdit,
  ShieldAlert,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
} from "lucide-react"
import {
  auditLogs,
  auditStats,
  AUDIT_EVENT_TYPES,
  AUDIT_TYPE_BADGE,
  type AuditLogEvent,
} from "@/lib/account-security-data"
import { accountUsers } from "@/lib/account-security-data"
import { SectionHeader, StatCard } from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const PERIODI = [
  { id: "oggi", label: "Oggi" },
  { id: "7g", label: "Ultimi 7 giorni" },
  { id: "mese", label: "Ultimo mese" },
  { id: "custom", label: "Personalizzato" },
]

const PAGE_SIZE = 20

export default function AuditLogPage() {
  const [periodo, setPeriodo] = useState("7g")
  const [tipo, setTipo] = useState("all")
  const [utente, setUtente] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditLogEvent | null>(null)

  const utentiUnici = useMemo(
    () => Array.from(new Set(accountUsers.map((u) => u.nome))),
    [],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return auditLogs.filter((l) => {
      if (tipo !== "all" && l.tipo !== tipo) return false
      if (utente !== "all" && l.utente !== utente) return false
      if (q && !l.desc.toLowerCase().includes(q)) return false
      return true
    })
  }, [tipo, utente, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function resetPage() {
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Audit & Log"
        description="Monitora tutte le attività del CRM. Tieni traccia di accessi, modifiche ai record e operazioni sensibili."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Accessi oggi" value={auditStats.accessiOggi} icon={<LogIn className="size-5" />} />
        <StatCard label="Modifiche record" value={auditStats.modificheRecord} icon={<FileEdit className="size-5" />} />
        <StatCard label="Login falliti" value={auditStats.loginFalliti} icon={<ShieldAlert className="size-5" />} />
        <StatCard label="Operazioni admin" value={auditStats.operazioniAdmin} icon={<ShieldCheck className="size-5" />} />
      </div>

      {/* Filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={periodo} onValueChange={(v) => { setPeriodo(v ?? "7g"); resetPage() }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {(v) => PERIODI.find((p) => p.id === v)?.label ?? "Periodo"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIODI.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={(v) => { setTipo(v ?? "all"); resetPage() }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {(v) => (v === "all" ? "Tutti i tipi" : (v as string))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {AUDIT_EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={utente} onValueChange={(v) => { setUtente(v ?? "all"); resetPage() }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {(v) => (v === "all" ? "Tutti gli utenti" : (v as string))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli utenti</SelectItem>
            {utentiUnici.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 sm:min-w-56">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
            placeholder="Cerca per descrizione"
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabella log */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Timestamp</TableHead>
              <TableHead>Utente</TableHead>
              <TableHead>Tipo evento</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Esito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((l) => (
              <TableRow
                key={l.id}
                className="cursor-pointer"
                onClick={() => setSelected(l)}
              >
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {l.ts}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground">
                  {l.utente === "unknown" ? (
                    <span className="text-muted-foreground italic">sconosciuto</span>
                  ) : (
                    l.utente
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                      AUDIT_TYPE_BADGE[l.tipo],
                    )}
                  >
                    {l.tipo}
                  </span>
                </TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {l.desc}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {l.ip}
                </TableCell>
                <TableCell>
                  {l.esito === "success" ? (
                    <Badge className="bg-teal/15 text-teal">Successo</Badge>
                  ) : (
                    <Badge variant="destructive">Fallito</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nessun evento trovato con i filtri selezionati.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Paginazione */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} eventi</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
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
            className="size-8"
            aria-label="Pagina successiva"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Drawer dettaglio evento */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-[480px]">
          {selected ? (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle>Dettaglio evento</SheetTitle>
                <SheetDescription>Informazioni complete sull&apos;attività registrata</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 overflow-y-auto px-4 py-2">
                <div className="flex items-center gap-3">
                  {selected.esito === "success" ? (
                    <CheckCircle className="size-8 text-teal" />
                  ) : (
                    <XCircle className="size-8 text-destructive" />
                  )}
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "inline-flex h-5 w-fit items-center rounded-full px-2 text-xs font-medium",
                        AUDIT_TYPE_BADGE[selected.tipo],
                      )}
                    >
                      {selected.tipo}
                    </span>
                    <span className="pt-1 text-xs text-muted-foreground">{selected.ts}</span>
                  </div>
                </div>

                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                  {selected.desc}
                </p>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Utente</dt>
                    <dd className="text-foreground">
                      {selected.utente === "unknown" ? "Sconosciuto" : selected.utente}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Indirizzo IP</dt>
                    <dd className="font-mono text-foreground">{selected.ip}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Esito</dt>
                    <dd className="text-foreground">
                      {selected.esito === "success" ? "Successo" : "Fallito"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">ID evento</dt>
                    <dd className="font-mono text-foreground">{selected.id}</dd>
                  </div>
                </dl>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
