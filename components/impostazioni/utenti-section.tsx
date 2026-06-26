"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Plus,
  MapPin,
  MoreHorizontal,
  Search,
  Pencil,
  Shield,
  Building2,
  Power,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import {
  mockUtenti,
  ROLE_LABEL,
  type SettingsUser,
  type UserRole,
} from "@/lib/mock-data"
import {
  RUOLO_COLOR_CLASS,
  USER_ROLE_COLORE,
  SEDI_DISPONIBILI,
} from "@/lib/ruoli-data"

const ROLE_OPTIONS: UserRole[] = ["admin", "commerciale", "tecnico"]

function roleColorClass(ruolo: UserRole) {
  return RUOLO_COLOR_CLASS[USER_ROLE_COLORE[ruolo]]
}

/** Avatar circolare grande con iniziali e colore del ruolo. */
function UserAvatar({ user }: { user: SettingsUser }) {
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        roleColorClass(user.ruolo),
      )}
      aria-hidden
    >
      {user.iniziali}
    </div>
  )
}

function RolePill({ ruolo }: { ruolo: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        roleColorClass(ruolo),
      )}
    >
      {ROLE_LABEL[ruolo]}
    </span>
  )
}

function UserCard({
  user,
  onToggleAttivo,
  onEdit,
  onChangeRole,
  onChangeSede,
  onDelete,
}: {
  user: SettingsUser
  onToggleAttivo: (id: string) => void
  onEdit: (user: SettingsUser) => void
  onChangeRole: (user: SettingsUser) => void
  onChangeSede: (user: SettingsUser) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-4 transition-opacity",
        !user.attivo && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight text-foreground">
            {user.nome}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Azioni per ${user.nome}`}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(user)}>
              <Pencil className="size-4" />
              Modifica
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChangeRole(user)}>
              <Shield className="size-4" />
              Cambia ruolo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChangeSede(user)}>
              <Building2 className="size-4" />
              Cambia sede
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleAttivo(user.id)}>
              <Power className="size-4" />
              {user.attivo ? "Disattiva" : "Attiva"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(user.id)}
            >
              <Trash2 className="size-4" />
              Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user.attivo ? (
          <RolePill ruolo={user.ruolo} />
        ) : (
          <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
            Inattivo
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {user.sede}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground">
          {user.attivo ? "Attivo" : "Inattivo"}
        </span>
        <Switch
          checked={user.attivo}
          onCheckedChange={() => onToggleAttivo(user.id)}
          aria-label={`Stato account di ${user.nome}`}
        />
      </div>
    </Card>
  )
}

export function UtentiSection() {
  const [users, setUsers] = useState<SettingsUser[]>(mockUtenti)
  const [ruoloFilter, setRuoloFilter] = useState<string>("all")
  const [sedeFilter, setSedeFilter] = useState<string>("all")
  const [query, setQuery] = useState("")

  // Stato del dialog di modifica/creazione utente.
  const [editing, setEditing] = useState<SettingsUser | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    email: "",
    ruolo: "commerciale" as UserRole,
    sede: SEDI_DISPONIBILI[0],
  })

  const sediOptions = useMemo(
    () => Array.from(new Set(users.map((u) => u.sede))),
    [users],
  )

  const filtered = users.filter((u) => {
    if (ruoloFilter !== "all" && u.ruolo !== ruoloFilter) return false
    if (sedeFilter !== "all" && u.sede !== sedeFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !u.nome.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  function toggleAttivo(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, attivo: !u.attivo } : u)),
    )
  }

  function changeRole(user: SettingsUser) {
    const idx = ROLE_OPTIONS.indexOf(user.ruolo)
    const next = ROLE_OPTIONS[(idx + 1) % ROLE_OPTIONS.length]
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, ruolo: next } : u)),
    )
    toast.success(`Ruolo di ${user.nome} aggiornato a ${ROLE_LABEL[next]}`)
  }

  function changeSede(user: SettingsUser) {
    const idx = SEDI_DISPONIBILI.indexOf(user.sede)
    const next = SEDI_DISPONIBILI[(idx + 1) % SEDI_DISPONIBILI.length]
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, sede: next as SettingsUser["sede"] } : u,
      ),
    )
    toast.success(`Sede di ${user.nome} aggiornata a ${next}`)
  }

  function deleteUser(id: string) {
    const u = users.find((x) => x.id === id)
    setUsers((prev) => prev.filter((x) => x.id !== id))
    if (u) toast.success(`${u.nome} eliminato`)
  }

  function openCreate() {
    setEditing(null)
    setForm({
      nome: "",
      email: "",
      ruolo: "commerciale",
      sede: SEDI_DISPONIBILI[0],
    })
    setDialogOpen(true)
  }

  function openEdit(user: SettingsUser) {
    setEditing(user)
    setForm({
      nome: user.nome,
      email: user.email,
      ruolo: user.ruolo,
      sede: user.sede,
    })
    setDialogOpen(true)
  }

  function saveUser() {
    if (!form.nome.trim()) {
      toast.error("Inserisci il nome dell'utente")
      return
    }
    if (editing) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                nome: form.nome,
                email: form.email,
                ruolo: form.ruolo,
                sede: form.sede as SettingsUser["sede"],
              }
            : u,
        ),
      )
      toast.success("Utente aggiornato")
    } else {
      const iniziali = form.nome
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
      setUsers((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          nome: form.nome,
          iniziali: iniziali || "??",
          email: form.email,
          ruolo: form.ruolo,
          sede: form.sede as SettingsUser["sede"],
          attivo: true,
        },
      ])
      toast.success("Utente creato")
    }
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Utenti"
        description="Gestisci gli account del team: ruolo, sede assegnata e stato di accesso al CRM."
        action={
          <Button
            onClick={openCreate}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
          >
            <Plus className="size-4" />
            Aggiungi utente
          </Button>
        }
      />

      {/* Filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={ruoloFilter}
          onValueChange={(v) => setRuoloFilter(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {(v) => (v === "all" ? "Tutti i ruoli" : ROLE_LABEL[v as UserRole])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sedeFilter}
          onValueChange={(v) => setSedeFilter(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {(v) => (v === "all" ? "Tutte le sedi" : (v as string))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sedi</SelectItem>
            {sediOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome o email"
            className="pl-8"
          />
        </div>
      </div>

      {/* Griglia card utenti */}
      {filtered.length === 0 ? (
        <Card className="flex items-center justify-center p-10 text-sm text-muted-foreground">
          Nessun utente corrisponde ai filtri selezionati.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              onToggleAttivo={toggleAttivo}
              onEdit={openEdit}
              onChangeRole={changeRole}
              onChangeSede={changeSede}
              onDelete={deleteUser}
            />
          ))}
        </div>
      )}

      {/* Dialog crea/modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica utente" : "Aggiungi utente"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Aggiorna i dati dell'account."
                : "Crea un nuovo account per il team."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-nome">Nome</Label>
              <Input
                id="user-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="nome@solairgroup.it"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Ruolo</Label>
                <Select
                  value={form.ruolo}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      ruolo: (v ?? "commerciale") as UserRole,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Sede</Label>
                <Select
                  value={form.sede}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, sede: v ?? SEDI_DISPONIBILI[0] }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEDI_DISPONIBILI.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={saveUser}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              {editing ? "Salva modifiche" : "Crea utente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
