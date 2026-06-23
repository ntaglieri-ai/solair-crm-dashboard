"use client"

import { useState } from "react"
import { toast } from "sonner"
import { IconPlus, IconKey } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockUtenti,
  ROLE_LABEL,
  SEDE_LABELS,
  type SettingsUser,
  type UserRole,
} from "@/lib/mock-data"
import {
  RoleBadge,
  InitialsAvatar,
  SectionHeader,
} from "@/components/impostazioni/settings-ui"

const ROLES: UserRole[] = ["admin", "commerciale", "tecnico"]
const SEDI_OPTIONS = ["Mostag Studio", ...SEDE_LABELS] as const

function initialsOf(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function AddUserDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreate: (u: SettingsUser) => void
}) {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [ruolo, setRuolo] = useState<UserRole>("commerciale")
  const [sede, setSede] = useState<string>(SEDE_LABELS[0])

  const valid = nome.trim() && email.trim()

  const reset = () => {
    setNome("")
    setEmail("")
    setRuolo("commerciale")
    setSede(SEDE_LABELS[0])
  }

  const submit = () => {
    if (!valid) return
    onCreate({
      id: `u-${Date.now()}`,
      nome: nome.trim(),
      iniziali: initialsOf(nome.trim()),
      email: email.trim(),
      ruolo,
      sede: sede as SettingsUser["sede"],
      attivo: true,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi utente</DialogTitle>
          <DialogDescription>
            Invia un invito a un nuovo membro del team. Riceverà un&apos;email
            per impostare la password.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-nome">Nome</Label>
            <Input
              id="u-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Mario Rossi"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-email">E-mail</Label>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mario.rossi@solairgroup.it"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Ruolo</Label>
              <Select value={ruolo} onValueChange={(v) => setRuolo(v as UserRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sede</Label>
              <Select value={sede} onValueChange={setSede}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SEDI_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Invita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UtentiSection() {
  const [users, setUsers] = useState<SettingsUser[]>(mockUtenti)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<SettingsUser | null>(null)

  // Stato del pannello di modifica.
  const [ruolo, setRuolo] = useState<UserRole>("commerciale")
  const [sede, setSede] = useState<string>(SEDE_LABELS[0])
  const [attivo, setAttivo] = useState(true)

  const openEdit = (u: SettingsUser) => {
    setEditing(u)
    setRuolo(u.ruolo)
    setSede(u.sede)
    setAttivo(u.attivo)
  }

  const toggleActive = (id: string) =>
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, attivo: !u.attivo } : u)),
    )

  const saveEdit = () => {
    if (!editing) return
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editing.id
          ? { ...u, ruolo, sede: sede as SettingsUser["sede"], attivo }
          : u,
      ),
    )
    toast.success("Utente aggiornato", { description: editing.nome })
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Utenti e ruoli"
        description="Gestisci i membri del team, i ruoli e le sedi assegnate."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <IconPlus size={16} stroke={2} data-icon="inline-start" />
            Aggiungi utente
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-muted-foreground">
                  Utente
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Ruolo
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Sede
                </TableHead>
                <TableHead className="text-right font-semibold text-muted-foreground">
                  Stato
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(u)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar iniziali={u.iniziali} />
                      <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-medium text-foreground">
                          {u.nome}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge ruolo={u.ruolo} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{u.sede}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-muted-foreground">
                        {u.attivo ? "Attivo" : "Inattivo"}
                      </span>
                      <Switch
                        checked={u.attivo}
                        onCheckedChange={() => toggleActive(u.id)}
                        aria-label={`Utente ${u.nome} attivo`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={(u) => {
          setUsers((prev) => [...prev, u])
          toast.success("Invito inviato", { description: u.email })
        }}
      />

      {/* Pannello laterale modifica utente */}
      <Sheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Modifica utente</SheetTitle>
            <SheetDescription>
              {editing?.nome} · {editing?.email}
            </SheetDescription>
          </SheetHeader>

          {editing ? (
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              <div className="flex items-center gap-3">
                <InitialsAvatar iniziali={editing.iniziali} />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-foreground">
                    {editing.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {editing.email}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Ruolo</Label>
                <Select
                  value={ruolo}
                  onValueChange={(v) => setRuolo(v as UserRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Sede</Label>
                <Select value={sede} onValueChange={setSede}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SEDI_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Account attivo
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Disattiva per sospendere l&apos;accesso.
                  </span>
                </div>
                <Switch checked={attivo} onCheckedChange={setAttivo} />
              </div>

              <Button
                variant="outline"
                className="justify-start"
                onClick={() =>
                  toast.success("E-mail di reset inviata", {
                    description: editing.email,
                  })
                }
              >
                <IconKey size={16} stroke={1.8} data-icon="inline-start" />
                Reimposta password
              </Button>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annulla
            </Button>
            <Button onClick={saveEdit}>Salva modifiche</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
