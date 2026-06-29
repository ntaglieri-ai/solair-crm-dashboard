"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Users, UserCheck, ShieldCheck, MapPin,
  MoreHorizontal, Search, Plus,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  RoleBadge, InitialsAvatar, SectionHeader, StatCard,
} from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"

const SEDI = ["Catania", "Giarre (CT)", "Treviso", "Torino", "Porto Sant'Elpidio"]

type Utente = {
  id: string
  nome: string
  email: string
  ruolo: string
  sede: string
  attivo: boolean
  created_at: string
}

const EMPTY_FORM = { nome: "", email: "", ruolo: "", sede: "", attivo: true }

function getIniziali(nome: string) {
  return nome.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function AccountManagementPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<Utente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [ruolo, setRuolo] = useState("")
  const [sede, setSede] = useState("")
  const [stato, setStato] = useState("")
  const [selected, setSelected] = useState<Utente | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_FORM)
  const [newSaving, setNewSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [profili, setProfili] = useState<{ id: string; code: string; nome: string }[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: utenti }, { data: ruoli }] = await Promise.all([
        supabase
          .from("utenti")
          .select("id, nome, email, ruolo, sede, attivo, created_at")
          .order("nome"),
        supabase
          .from("ruoli")
          .select("id, code, nome")
          .order("ordinamento", { ascending: true }),
      ])
      setUsers(utenti ?? [])
      setProfili(ruoli ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => ({
    totali: users.length,
    attivi: users.filter((u) => u.attivo).length,
    admin: users.filter((u) => u.ruolo === "admin").length,
    sedi: new Set(users.map((u) => u.sede)).size,
  }), [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !u.nome.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      if (ruolo && u.ruolo !== ruolo) return false
      if (sede && u.sede !== sede) return false
      if (stato === "active" && !u.attivo) return false
      if (stato === "inactive" && u.attivo) return false
      return true
    })
  }, [users, search, ruolo, sede, stato])

  async function toggleAttivo(id: string, current: boolean) {
    await supabase.from("utenti").update({ attivo: !current }).eq("id", id)
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, attivo: !current } : u))
    setSelected((prev) => prev?.id === id ? { ...prev, attivo: !current } : prev)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setNewSaving(true)
    const { data, error } = await supabase
      .from("utenti")
      .insert([{ nome: newForm.nome, email: newForm.email, ruolo: newForm.ruolo, sede: newForm.sede, attivo: newForm.attivo }])
      .select("id, nome, email, ruolo, sede, attivo, created_at")
      .single()
    if (!error && data) {
      setUsers((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setNewOpen(false)
      setNewForm(EMPTY_FORM)
    }
    setNewSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from("utenti").delete().eq("id", deleteTarget)
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget))
    if (selected?.id === deleteTarget) setSelected(null)
    setDeleteTarget(null)
    setDeleting(false)
  }

  function openDelete(id: string) {
    setSelected(null)
    setDeleteTarget(id)
  }

  if (loading) return <div className="p-8 text-muted-foreground">Caricamento utenti...</div>

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Account Management"
        description="Gestisci gli account nominativi del team Solair. Ogni utente ha credenziali proprie, un ruolo e una sede assegnata."
        action={
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Nuovo account
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utenti totali" value={stats.totali} icon={<Users className="size-5" />} />
        <StatCard label="Utenti attivi" value={stats.attivi} icon={<UserCheck className="size-5" />} />
        <StatCard label="Admin" value={stats.admin} icon={<ShieldCheck className="size-5" />} />
        <StatCard label="Sedi coperte" value={stats.sedi} icon={<MapPin className="size-5" />} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome o email" className="pl-9" />
        </div>
        <Select value={ruolo} onValueChange={(v) => setRuolo(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tutti i ruoli" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {profili.map((r) => <SelectItem key={r.id} value={r.code}>{r.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sede} onValueChange={(v) => setSede(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tutte le sedi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sedi</SelectItem>
            {SEDI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stato} onValueChange={(v) => setStato(v === "all" ? "" : v)}>
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
            {filtered.map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelected(u)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar iniziali={getIniziali(u.nome)} />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{u.nome}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell><RoleBadge ruolo={u.ruolo} /></TableCell>
                <TableCell className="text-muted-foreground">{u.sede}</TableCell>
                <TableCell className="text-muted-foreground">{formatData(u.created_at)}</TableCell>
                <TableCell>
                  {u.attivo
                    ? <Badge className="bg-teal/15 text-teal">Attivo</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Inattivo</Badge>}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                          aria-label="Azioni account"
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(u)}>Modifica</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAttivo(u.id, u.attivo)}>
                        {u.attivo ? "Disattiva" : "Attiva"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => openDelete(u.id)}>
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nessun account trovato.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sheet — Nuovo account */}
      <Sheet open={newOpen} onOpenChange={(open) => { if (!open) { setNewOpen(false); setNewForm(EMPTY_FORM) } }}>
        <SheetContent className="w-full sm:max-w-[480px]">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Nuovo account</SheetTitle>
            <SheetDescription>Crea un nuovo utente per il team Solair.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-nome">Nome</Label>
              <Input
                id="new-nome"
                required
                value={newForm.nome}
                onChange={(e) => setNewForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Mario Rossi"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                required
                value={newForm.email}
                onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="mario@solair.it"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ruolo</Label>
              <Select value={newForm.ruolo} onValueChange={(v) => setNewForm((f) => ({ ...f, ruolo: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona ruolo" /></SelectTrigger>
                <SelectContent>
                  {profili.map((r) => <SelectItem key={r.id} value={r.code}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sede</Label>
              <Select value={newForm.sede} onValueChange={(v) => setNewForm((f) => ({ ...f, sede: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona sede" /></SelectTrigger>
                <SelectContent>
                  {SEDI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Attivo</span>
                <span className="text-xs text-muted-foreground">L&apos;utente può accedere al sistema</span>
              </div>
              <Switch
                checked={newForm.attivo}
                onCheckedChange={(v) => setNewForm((f) => ({ ...f, attivo: v }))}
              />
            </div>
            <SheetFooter className="border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => { setNewOpen(false); setNewForm(EMPTY_FORM) }}>
                Annulla
              </Button>
              <Button type="submit" className="bg-teal text-teal-foreground hover:bg-teal/90" disabled={newSaving}>
                {newSaving ? "Salvataggio..." : "Crea account"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Sheet — Dettaglio utente */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent className="w-full sm:max-w-[480px]">
          {selected && (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle>Dettaglio account</SheetTitle>
                <SheetDescription>Informazioni dell&apos;utente</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
                <div className="flex items-center gap-4">
                  <InitialsAvatar iniziali={getIniziali(selected.nome)} className="size-14 text-lg" />
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{selected.nome}</span>
                    <span className="text-sm text-muted-foreground">{selected.email}</span>
                    <div className="flex items-center gap-2 pt-1">
                      <RoleBadge ruolo={selected.ruolo} />
                      <span className="text-xs text-muted-foreground">{selected.sede}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Stato account</span>
                    <span className="text-xs text-muted-foreground">{selected.attivo ? "Attivo" : "Inattivo"}</span>
                  </div>
                  <Switch checked={selected.attivo} onCheckedChange={() => toggleAttivo(selected.id, selected.attivo)} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Creato il</dt>
                    <dd>{formatData(selected.created_at)}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Sede</dt>
                    <dd>{selected.sede}</dd>
                  </div>
                </dl>
                <Button variant="outline" className="w-full">Reimposta password</Button>
              </div>
              <SheetFooter className="border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => openDelete(selected.id)}
                >
                  Elimina account
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog — Conferma eliminazione */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina account</DialogTitle>
            <DialogDescription>
              Questa operazione è irreversibile. L&apos;account verrà eliminato definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
