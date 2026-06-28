"use client"

import { useMemo, useState } from "react"
import {
  Users,
  UserCheck,
  ShieldCheck,
  MapPin,
  MoreHorizontal,
  Search,
  Plus,
  Monitor,
} from "lucide-react"
import {
  accountUsers,
  ACCOUNT_SEDI,
  type AccountUser,
} from "@/lib/account-security-data"
import { ROLE_LABEL, type UserRole } from "@/lib/mock-data"
import {
  RoleBadge,
  InitialsAvatar,
  SectionHeader,
  StatCard,
} from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"

export default function AccountManagementPage() {
  const [users, setUsers] = useState<AccountUser[]>(accountUsers)
  const [search, setSearch] = useState("")
  const [ruolo, setRuolo] = useState<string>("all")
  const [sede, setSede] = useState<string>("all")
  const [stato, setStato] = useState<string>("all")
  const [selected, setSelected] = useState<AccountUser | null>(null)

  const stats = useMemo(() => {
    const totali = users.length
    const attivi = users.filter((u) => u.attivo).length
    const admin = users.filter((u) => u.ruolo === "admin").length
    const sedi = new Set(users.map((u) => u.sede)).size
    return { totali, attivi, admin, sedi }
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !u.nome.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
        return false
      if (ruolo !== "all" && u.ruolo !== ruolo) return false
      if (sede !== "all" && u.sede !== sede) return false
      if (stato === "active" && !u.attivo) return false
      if (stato === "inactive" && u.attivo) return false
      return true
    })
  }, [users, search, ruolo, sede, stato])

  function toggleAttivo(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, attivo: !u.attivo } : u)),
    )
    setSelected((prev) => (prev?.id === id ? { ...prev, attivo: !prev.attivo } : prev))
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Account Management"
        description="Gestisci gli account nominativi del team Solair. Ogni utente ha credenziali proprie, un ruolo e una sede assegnata."
        action={
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
            <Plus className="size-4" />
            Nuovo account
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utenti totali" value={stats.totali} icon={<Users className="size-5" />} />
        <StatCard label="Utenti attivi" value={stats.attivi} icon={<UserCheck className="size-5" />} />
        <StatCard label="Admin" value={stats.admin} icon={<ShieldCheck className="size-5" />} />
        <StatCard label="Sedi coperte" value={stats.sedi} icon={<MapPin className="size-5" />} />
      </div>

      {/* Filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email"
            className="pl-9"
          />
        </div>
        <Select value={ruolo} onValueChange={(v) => setRuolo(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {(v) => (v === "all" ? "Tutti i ruoli" : ROLE_LABEL[v as UserRole])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="commerciale">Commerciale</SelectItem>
            <SelectItem value="tecnico">Tecnico</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sede} onValueChange={(v) => setSede(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {(v) => (v === "all" ? "Tutte le sedi" : (v as string))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sedi</SelectItem>
            {ACCOUNT_SEDI.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stato} onValueChange={(v) => setStato(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>
              {(v) =>
                v === "active"
                  ? "Attivo"
                  : v === "inactive"
                    ? "Inattivo"
                    : "Tutti gli stati"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivo</SelectItem>
            <SelectItem value="inactive">Inattivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabella */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Ultimo accesso</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-12 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow
                key={u.id}
                className="cursor-pointer"
                onClick={() => setSelected(u)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar iniziali={u.iniziali} />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{u.nome}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge ruolo={u.ruolo} />
                </TableCell>
                <TableCell className="text-muted-foreground">{u.sede}</TableCell>
                <TableCell className="text-muted-foreground">{u.ultimoAccesso}</TableCell>
                <TableCell>
                  {u.attivo ? (
                    <Badge className="bg-teal/15 text-teal">Attivo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inattivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Azioni account" />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(u)}>
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem>Cambia ruolo</DropdownMenuItem>
                      <DropdownMenuItem>Cambia sede</DropdownMenuItem>
                      <DropdownMenuItem>Reimposta password</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAttivo(u.id)}>
                        {u.attivo ? "Disattiva" : "Attiva"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive">Elimina</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nessun account trovato con i filtri selezionati.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Drawer dettaglio account */}
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
                <SheetTitle>Dettaglio account</SheetTitle>
                <SheetDescription>Informazioni e sessioni dell&apos;utente</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 overflow-y-auto px-4 py-2">
                <div className="flex items-center gap-4">
                  <InitialsAvatar iniziali={selected.iniziali} className="size-14 text-lg" />
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold text-foreground">
                      {selected.nome}
                    </span>
                    <span className="text-sm text-muted-foreground">{selected.email}</span>
                    <div className="flex items-center gap-2 pt-1">
                      <RoleBadge ruolo={selected.ruolo} />
                      <span className="text-xs text-muted-foreground">{selected.sede}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Stato account</span>
                    <span className="text-xs text-muted-foreground">
                      {selected.attivo ? "Attivo" : "Inattivo"}
                    </span>
                  </div>
                  <Switch
                    checked={selected.attivo}
                    onCheckedChange={() => toggleAttivo(selected.id)}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Ultimo accesso</dt>
                    <dd className="text-foreground">{selected.ultimoAccesso}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Account creato</dt>
                    <dd className="text-foreground">{selected.creato}</dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Sessioni attive</span>
                  <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Monitor className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">Chrome · Milano</span>
                      <span className="text-xs text-muted-foreground">Oggi 09:14</span>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  Reimposta password
                </Button>
              </div>

              <SheetFooter className="border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Elimina account
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
