"use client"

import { useEffect, useMemo, useState } from "react"
import {
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react"
import {
  InitialsAvatar,
  SectionHeader,
  StatCard,
} from "@/components/impostazioni/settings-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const DEFAULT_SEDI = ["Catania", "Giarre (CT)", "Treviso", "Torino", "Porto Sant'Elpidio"]
const EMPTY_FORM = { nome: "", email: "", ruolo: "", sede: "", attivo: true }

type Utente = {
  id: string
  nome: string
  email: string
  ruolo: string
  ruolo_id: string | null
  sede: string
  attivo: boolean
  created_at: string
}

type RuoloProfilo = {
  id: string
  code: string
  nome: string
}

type UserForm = typeof EMPTY_FORM

function getIniziali(nome: string) {
  return nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function roleTone(code: string) {
  const normalized = code.toUpperCase()
  if (normalized === "SUPERADMIN" || normalized === "ADMIN") return "navy"
  if (normalized === "AGENT" || normalized === "STANDARD") return "teal"
  return "gray"
}

function RolePill({ code, label }: { code: string; label: string }) {
  const tone = roleTone(code)
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        tone === "navy" && "bg-navy text-navy-foreground",
        tone === "teal" && "bg-teal text-teal-foreground",
        tone === "gray" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
}

function userToForm(user: Utente): UserForm {
  return {
    nome: user.nome,
    email: user.email,
    ruolo: user.ruolo,
    sede: user.sede,
    attivo: user.attivo,
  }
}

export default function AccountManagementPage() {
  const [users, setUsers] = useState<Utente[]>([])
  const [roles, setRoles] = useState<RuoloProfilo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [ruolo, setRuolo] = useState("")
  const [sede, setSede] = useState("")
  const [stato, setStato] = useState("")
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState<UserForm>(EMPTY_FORM)
  const [selected, setSelected] = useState<Utente | null>(null)
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Utente | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/crm-settings/utenti", { cache: "no-store" })
      const body = (await res.json().catch(() => null)) as {
        utenti?: Utente[]
        ruoli?: RuoloProfilo[]
        error?: string
      } | null
      if (!res.ok) throw new Error(body?.error ?? "Caricamento utenti non riuscito")
      setUsers(body?.utenti ?? [])
      setRoles(body?.ruoli ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caricamento utenti non riuscito")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const roleLabel = useMemo(
    () => new Map(roles.map((role) => [role.code, role.nome])),
    [roles],
  )

  const sedi = useMemo(() => {
    const values = new Set([...DEFAULT_SEDI, ...users.map((user) => user.sede)])
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [users])

  const stats = useMemo(
    () => ({
      totali: users.length,
      attivi: users.filter((u) => u.attivo).length,
      admin: users.filter((u) =>
        ["SUPERADMIN", "ADMIN"].includes(u.ruolo.toUpperCase()),
      ).length,
      sedi: new Set(users.map((u) => u.sede)).size,
    }),
    [users],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !u.nome.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false
      }
      if (ruolo && u.ruolo !== ruolo) return false
      if (sede && u.sede !== sede) return false
      if (stato === "active" && !u.attivo) return false
      if (stato === "inactive" && u.attivo) return false
      return true
    })
  }, [users, search, ruolo, sede, stato])

  function openEdit(user: Utente) {
    setSelected(user)
    setEditForm(userToForm(user))
    setError(null)
  }

  async function saveUser(id: string, form: UserForm) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/crm-settings/utenti/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const body = (await res.json().catch(() => null)) as {
        utente?: Utente
        error?: string
      } | null
      if (!res.ok || !body?.utente) {
        throw new Error(body?.error ?? "Salvataggio utente non riuscito")
      }
      setUsers((prev) =>
        prev
          .map((user) => (user.id === id ? body.utente! : user))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      )
      setSelected(body.utente)
      setEditForm(userToForm(body.utente))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio utente non riuscito")
    } finally {
      setSaving(false)
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.nome.trim() || !newForm.email.trim() || !newForm.ruolo || !newForm.sede) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/crm-settings/utenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      })
      const body = (await res.json().catch(() => null)) as {
        utente?: Utente
        error?: string
      } | null
      if (!res.ok || !body?.utente) {
        throw new Error(body?.error ?? "Creazione account non riuscita")
      }
      setUsers((prev) =>
        [...prev, body.utente!].sort((a, b) => a.nome.localeCompare(b.nome)),
      )
      setNewOpen(false)
      setNewForm(EMPTY_FORM)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creazione account non riuscita")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user: Utente) {
    await saveUser(user.id, { ...userToForm(user), attivo: !user.attivo })
  }

  async function deleteUser() {
    if (!deleteTarget) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/crm-settings/utenti/${deleteTarget.id}`, {
        method: "DELETE",
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(body?.error ?? "Eliminazione account non riuscita")
      setUsers((prev) => prev.filter((user) => user.id !== deleteTarget.id))
      if (selected?.id === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eliminazione account non riuscita")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Caricamento utenti...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Account Management"
        description="Gestisci account nominativi, ruolo, sede, stato di accesso e profilo operativo."
        action={
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => {
              setNewForm(EMPTY_FORM)
              setNewOpen(true)
            }}
          >
            <Plus className="size-4" />
            Nuovo account
          </Button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utenti totali" value={stats.totali} icon={<Users className="size-5" />} />
        <StatCard label="Utenti attivi" value={stats.attivi} icon={<UserCheck className="size-5" />} />
        <StatCard label="Admin" value={stats.admin} icon={<ShieldCheck className="size-5" />} />
        <StatCard label="Sedi coperte" value={stats.sedi} icon={<MapPin className="size-5" />} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email"
            className="pl-9"
          />
        </div>
        <Select value={ruolo} onValueChange={(v) => setRuolo(v === "all" ? "" : v ?? "")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tutti i ruoli" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.code}>
                {role.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sede} onValueChange={(v) => setSede(v === "all" ? "" : v ?? "")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tutte le sedi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sedi</SelectItem>
            {sedi.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stato} onValueChange={(v) => setStato(v === "all" ? "" : v ?? "")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivo</SelectItem>
            <SelectItem value="inactive">Inattivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Creato il</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-12 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => openEdit(user)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar iniziali={getIniziali(user.nome)} />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{user.nome}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <RolePill
                    code={user.ruolo}
                    label={roleLabel.get(user.ruolo) ?? user.ruolo}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{user.sede}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatData(user.created_at)}
                </TableCell>
                <TableCell>
                  {user.attivo ? (
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
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                          aria-label="Azioni account"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(user)}>
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(user)}>
                        {user.attivo ? "Disattiva" : "Attiva"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(user)}
                      >
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nessun account trovato.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <UserSheet
        title="Nuovo account"
        description="Crea un nuovo utente e assegna subito ruolo, sede e stato."
        open={newOpen}
        form={newForm}
        roles={roles}
        sedi={sedi}
        saving={saving}
        submitLabel="Crea account"
        onOpenChange={(open) => {
          setNewOpen(open)
          if (!open) setNewForm(EMPTY_FORM)
        }}
        onChange={setNewForm}
        onSubmit={createUser}
      />

      <UserSheet
        title="Modifica account"
        description="Aggiorna anagrafica, ruolo, sede e stato operativo."
        open={selected !== null}
        form={editForm}
        roles={roles}
        sedi={sedi}
        saving={saving}
        submitLabel="Salva modifiche"
        dangerLabel="Elimina account"
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onChange={setEditForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (selected) saveUser(selected.id, editForm)
        }}
        onDanger={() => {
          if (selected) setDeleteTarget(selected)
        }}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina account</DialogTitle>
            <DialogDescription>
              Questa azione rimuove l&apos;utente da CRM Settings. L&apos;account
              Auth Supabase, se presente, va gestito dalla console Auth o da una
              funzione service-role dedicata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={deleteUser} disabled={saving}>
              {saving ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserSheet({
  title,
  description,
  open,
  form,
  roles,
  sedi,
  saving,
  submitLabel,
  dangerLabel,
  onOpenChange,
  onChange,
  onSubmit,
  onDanger,
}: {
  title: string
  description: string
  open: boolean
  form: UserForm
  roles: RuoloProfilo[]
  sedi: string[]
  saving: boolean
  submitLabel: string
  dangerLabel?: string
  onOpenChange: (open: boolean) => void
  onChange: (form: UserForm) => void
  onSubmit: (event: React.FormEvent) => void
  onDanger?: () => void
}) {
  const canSubmit =
    !saving &&
    form.nome.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.ruolo.length > 0 &&
    form.sede.length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px]">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <InitialsAvatar iniziali={getIniziali(form.nome || "Utente")} className="size-14 text-lg" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {form.nome || "Nuovo utente"}
              </span>
              <span className="text-xs text-muted-foreground">
                {form.email || "Email non impostata"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${title}-nome`}>Nome</Label>
            <Input
              id={`${title}-nome`}
              value={form.nome}
              onChange={(e) => onChange({ ...form, nome: e.target.value })}
              placeholder="Mario Rossi"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${title}-email`}>Email</Label>
            <Input
              id={`${title}-email`}
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              placeholder="mario@solair.it"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Ruolo</Label>
              <Select
                value={form.ruolo}
                onValueChange={(value) => onChange({ ...form, ruolo: value ?? "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.code}>
                      {role.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sede</Label>
              <Select
                value={form.sede}
                onValueChange={(value) => onChange({ ...form, sede: value ?? "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona sede" />
                </SelectTrigger>
                <SelectContent>
                  {sedi.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Account attivo</span>
              <span className="text-xs text-muted-foreground">
                L&apos;utente puo accedere al sistema se ha credenziali Auth valide.
              </span>
            </div>
            <Switch
              checked={form.attivo}
              onCheckedChange={(value) => onChange({ ...form, attivo: value === true })}
            />
          </div>
          <SheetFooter className="border-t border-border pt-4">
            {dangerLabel && onDanger ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDanger}
              >
                {dangerLabel}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button
              type="submit"
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              disabled={!canSubmit}
            >
              {saving ? "Salvataggio..." : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
