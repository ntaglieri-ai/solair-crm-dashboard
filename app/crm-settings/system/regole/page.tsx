"use client"

import { useState } from "react"
import { Plus, MoreHorizontal, Pencil, Trash2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  SectionHeader,
  InitialsAvatar,
} from "@/components/impostazioni/settings-ui"
import {
  regoleIniziali,
  UTENTI_ASSEGNABILI,
  type RegolaAssegnazione,
} from "@/lib/system-settings-data"

function iniziali(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default function RegolePage() {
  const [regole, setRegole] = useState<RegolaAssegnazione[]>(regoleIniziali)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RegolaAssegnazione | null>(null)

  const [nome, setNome] = useState("")
  const [campo, setCampo] = useState("citta")
  const [operatore, setOperatore] = useState("=")
  const [valore, setValore] = useState("")
  const [assegnaA, setAssegnaA] = useState(UTENTI_ASSEGNABILI[0])

  function openNew() {
    setEditing(null)
    setNome("")
    setCampo("citta")
    setOperatore("=")
    setValore("")
    setAssegnaA(UTENTI_ASSEGNABILI[0])
    setDialogOpen(true)
  }

  function openEdit(r: RegolaAssegnazione) {
    setEditing(r)
    setNome(r.nome)
    setCampo(r.condizioni[0]?.campo ?? "citta")
    setOperatore(r.condizioni[0]?.operatore ?? "=")
    setValore(r.condizioni[0]?.valore ?? "")
    setAssegnaA(r.assegna_a)
    setDialogOpen(true)
  }

  function handleSave() {
    if (!nome.trim()) return
    const condizioni = [{ campo, operatore, valore }]
    if (editing) {
      setRegole((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, nome, condizioni, assegna_a: assegnaA }
            : r,
        ),
      )
    } else {
      setRegole((prev) => [
        ...prev,
        {
          id: `reg_${Date.now()}`,
          nome,
          attiva: true,
          modulo: "lead",
          condizioni,
          assegna_a: assegnaA,
        },
      ])
    }
    setDialogOpen(false)
  }

  function toggleAttiva(id: string) {
    setRegole((prev) =>
      prev.map((r) => (r.id === id ? { ...r, attiva: !r.attiva } : r)),
    )
  }

  function handleDelete(id: string) {
    setRegole((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Regole di assegnazione"
        description="Configura le regole automatiche di assegnazione dei lead agli utenti."
        action={
          <Button
            onClick={openNew}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
          >
            <Plus className="size-4" />
            Nuova regola
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {regole.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{r.nome}</span>
                <span className="inline-flex items-center rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                  {r.modulo}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={r.attiva}
                  onCheckedChange={() => toggleAttiva(r.id)}
                  aria-label={`Regola ${r.nome} attiva`}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Azioni per ${r.nome}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(r)}>
                      <Pencil className="size-4" />
                      Modifica
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="size-4" />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {r.condizioni.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground"
                >
                  Se{" "}
                  <span className="font-medium text-foreground">{c.campo}</span>
                  <span className="font-mono">{c.operatore}</span>
                  <span className="font-medium text-foreground">
                    {c.valore}
                  </span>
                </span>
              ))}
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="inline-flex items-center gap-2 rounded-lg bg-teal/10 px-2.5 py-1">
                <InitialsAvatar
                  iniziali={iniziali(r.assegna_a)}
                  className="size-6 bg-teal text-teal-foreground"
                />
                <span className="font-medium text-foreground">
                  {r.assegna_a}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica regola" : "Nuova regola"}
            </DialogTitle>
            <DialogDescription>
              Le regole assegnano automaticamente i lead in base alle
              condizioni.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="regola-nome">Nome regola</Label>
              <Input
                id="regola-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Lead Catania → Gaetano"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Condizione</Label>
              <div className="flex gap-2">
                <Input
                  value={campo}
                  onChange={(e) => setCampo(e.target.value)}
                  placeholder="campo"
                  className="flex-1"
                  aria-label="Campo"
                />
                <Select
                  value={operatore}
                  onValueChange={(v) => setOperatore(v ?? "=")}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="=">=</SelectItem>
                    <SelectItem value="≠">≠</SelectItem>
                    <SelectItem value="contiene">contiene</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={valore}
                  onChange={(e) => setValore(e.target.value)}
                  placeholder="valore"
                  className="flex-1"
                  aria-label="Valore"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Assegna a</Label>
              <Select
                value={assegnaA}
                onValueChange={(v) => setAssegnaA(v ?? UTENTI_ASSEGNABILI[0])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UTENTI_ASSEGNABILI.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
