"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { StorageRoleBadge } from "@/components/file-manager/storage-role-badge"
import { Folder, MoreHorizontal, Plus, Check } from "lucide-react"
import {
  CARTELLE_CONDIVISE,
  STORAGE_ROLES,
  type CartellaCondivisa,
  type AccessoCartella,
} from "@/lib/file-manager-data"
import { cn } from "@/lib/utils"

interface FormState {
  id: string | null
  nome: string
  path: string
  ruoli: string[]
  accesso: AccessoCartella
}

const EMPTY_FORM: FormState = {
  id: null,
  nome: "",
  path: "/Condivise/",
  ruoli: [],
  accesso: "r",
}

export default function CondivisePage() {
  const [cartelle, setCartelle] = useState<CartellaCondivisa[]>(CARTELLE_CONDIVISE)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  function openNew() {
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(c: CartellaCondivisa) {
    setForm({
      id: c.id,
      nome: c.nome,
      path: c.path,
      ruoli: [...c.ruoli_accesso],
      accesso: c.accesso,
    })
    setOpen(true)
  }

  function toggleRuolo(nome: string) {
    setForm((f) => ({
      ...f,
      ruoli: f.ruoli.includes(nome)
        ? f.ruoli.filter((r) => r !== nome)
        : [...f.ruoli, nome],
    }))
  }

  function remove(id: string) {
    setCartelle((prev) => prev.filter((c) => c.id !== id))
  }

  function save() {
    if (form.id) {
      setCartelle((prev) =>
        prev.map((c) =>
          c.id === form.id
            ? { ...c, nome: form.nome, path: form.path, ruoli_accesso: form.ruoli, accesso: form.accesso }
            : c,
        ),
      )
    } else {
      setCartelle((prev) => [
        ...prev,
        {
          id: `cc_${Date.now()}`,
          nome: form.nome || "Nuova cartella",
          path: form.path,
          ruoli_accesso: form.ruoli,
          accesso: form.accesso,
        },
      ])
    }
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Cartelle condivise"
        description="Cartelle Nextcloud non collegate a record specifici, accessibili a più utenti in base al ruolo."
        action={
          <Button
            type="button"
            onClick={openNew}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
          >
            <Plus className="size-4" />
            Aggiungi cartella
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {cartelle.map((c) => (
          <Card key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                <Folder className="size-5" />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="font-semibold text-foreground">{c.nome}</span>
                <code className="text-xs text-muted-foreground">{c.path}</code>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {c.ruoli_accesso.map((r) => (
                    <StorageRoleBadge key={r} ruolo={r} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <Badge
                className={
                  c.accesso === "rw"
                    ? "bg-teal text-teal-foreground"
                    : "bg-muted text-muted-foreground"
                }
              >
                {c.accesso === "rw" ? "Lettura e scrittura" : "Solo lettura"}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Azioni cartella" />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(c)}>
                    Modifica
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => remove(c.id)}
                  >
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {/* Modale aggiungi / modifica */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Modifica cartella condivisa" : "Aggiungi cartella condivisa"}
            </DialogTitle>
            <DialogDescription>
              Definisci nome, percorso Nextcloud e ruoli che possono accedervi.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cc-nome">Nome</Label>
              <Input
                id="cc-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Es. Materiale commerciale"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cc-path">Path Nextcloud</Label>
              <Input
                id="cc-path"
                value={form.path}
                onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                className="font-mono text-xs"
                placeholder="/Condivise/…/"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Ruoli con accesso</Label>
              <div className="flex flex-wrap gap-2">
                {STORAGE_ROLES.map((r) => {
                  const selected = form.ruoli.includes(r.nome)
                  return (
                    <button
                      key={r.nome}
                      type="button"
                      onClick={() => toggleRuolo(r.nome)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-teal bg-teal/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {selected ? <Check className="size-3 text-teal" /> : null}
                      {r.nome}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tipo di accesso</Label>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: "r" as const, label: "Solo lettura" },
                    { value: "rw" as const, label: "Lettura e scrittura" },
                  ]
                ).map((opt) => {
                  const checked = form.accesso === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, accesso: opt.value }))}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        checked
                          ? "border-teal bg-teal/5 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border",
                          checked ? "border-teal" : "border-muted-foreground/40",
                        )}
                      >
                        {checked ? (
                          <span className="size-2 rounded-full bg-teal" />
                        ) : null}
                      </span>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              type="button"
              onClick={save}
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
