"use client"

import { useState } from "react"
import { Plus, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"
import {
  campiPerModulo,
  MODULI_ATTRIBUTI,
  CAMPO_TIPI,
  CAMPO_TIPO_LABEL,
  CAMPO_ACCESSO_LABEL,
  type ModuloAttributi,
  type CampoRecord,
  type CampoAccesso,
  type CampoTipo,
} from "@/lib/system-settings-data"
import { usePermissions } from "@/lib/permissions/provider"

const ACCESSO_OPZIONI: CampoAccesso[] = ["no_access", "r", "rw"]

function moduloKey(modulo: ModuloAttributi) {
  return modulo.toLowerCase()
}

export default function AttributiPage() {
  const permissions = usePermissions()
  const [modulo, setModulo] = useState<ModuloAttributi>("Lead")
  const [tutti, setTutti] = useState<Record<ModuloAttributi, CampoRecord[]>>(
    () => structuredClone(campiPerModulo),
  )
  const [dialogOpen, setDialogOpen] = useState(false)

  // Stato modale nuovo campo.
  const [nome, setNome] = useState("")
  const [etichetta, setEtichetta] = useState("")
  const [tipo, setTipo] = useState<CampoTipo>("text")
  const [obbligatorio, setObbligatorio] = useState(false)
  const [accesso, setAccesso] = useState<CampoAccesso>("rw")

  const campi = tutti[modulo]
  const nomeValido = /^[a-z][a-z0-9_]*$/.test(nome)
  const currentModule = moduloKey(modulo)
  const canCreateFields = permissions.canAction(`${currentModule}.fields.create`)
  const canEditFields = permissions.canAction(`${currentModule}.fields.edit`)
  const canDeleteFields = permissions.canAction(`${currentModule}.fields.delete`)
  const canManageVisibility = permissions.canAction(
    `${currentModule}.fields.visibility.manage`,
  )
  const canManageRequired = permissions.canAction(
    `${currentModule}.fields.required.manage`,
  )

  function updateCampo(nomeCampo: string, patch: Partial<CampoRecord>) {
    setTutti((prev) => ({
      ...prev,
      [modulo]: prev[modulo].map((c) =>
        c.nome === nomeCampo ? { ...c, ...patch } : c,
      ),
    }))
  }

  function deleteCampo(nomeCampo: string) {
    setTutti((prev) => ({
      ...prev,
      [modulo]: prev[modulo].filter((c) => c.nome !== nomeCampo),
    }))
  }

  function openNew() {
    if (!canCreateFields) return
    setNome("")
    setEtichetta("")
    setTipo("text")
    setObbligatorio(false)
    setAccesso("rw")
    setDialogOpen(true)
  }

  function handleSave() {
    if (!canCreateFields || !nomeValido || !etichetta.trim()) return
    setTutti((prev) => ({
      ...prev,
      [modulo]: [
        ...prev[modulo],
        {
          nome,
          etichetta,
          tipo,
          obbligatorio,
          visibile: true,
          accesso_default: accesso,
          sistema: false,
        },
      ],
    }))
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Attributi record"
        description="Gestisci i campi personalizzati per ogni modulo. I nuovi campi vengono automaticamente aggiunti alla matrice permessi per tutti i ruoli."
      />

      {/* Tab selector modulo */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {MODULI_ATTRIBUTI.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModulo(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              modulo === m
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo</TableHead>
              <TableHead>Etichetta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-center">Obbligatorio</TableHead>
              <TableHead className="text-center">Visibile</TableHead>
              <TableHead>Accesso default</TableHead>
              <TableHead className="text-center">Sistema</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campi.map((campo) => (
              <TableRow key={campo.nome}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {campo.nome}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {campo.etichetta}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {CAMPO_TIPO_LABEL[campo.tipo]}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={campo.obbligatorio}
                    disabled={!canManageRequired}
                    onCheckedChange={(v) =>
                      updateCampo(campo.nome, { obbligatorio: v })
                    }
                    aria-label={`${campo.etichetta} obbligatorio`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={campo.visibile}
                    disabled={!canManageVisibility}
                    onCheckedChange={(v) =>
                      updateCampo(campo.nome, { visibile: v })
                    }
                    aria-label={`${campo.etichetta} visibile`}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={campo.accesso_default}
                    disabled={!canManageVisibility}
                    onValueChange={(v) =>
                      updateCampo(campo.nome, {
                        accesso_default: (v ?? "rw") as CampoAccesso,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue>
                        {(v) => CAMPO_ACCESSO_LABEL[v as CampoAccesso]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESSO_OPZIONI.map((a) => (
                        <SelectItem key={a} value={a}>
                          {CAMPO_ACCESSO_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center">
                  {campo.sistema ? (
                    <Lock
                      className="mx-auto size-4 text-muted-foreground"
                      aria-label="Campo di sistema"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {campo.sistema || (!canEditFields && !canDeleteFields) ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Azioni per ${campo.etichetta}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!canEditFields}
                          onClick={() => {
                            const nuova = window.prompt(
                              "Nuova etichetta",
                              campo.etichetta,
                            )
                            if (nuova) updateCampo(campo.nome, { etichetta: nuova })
                          }}
                        >
                          <Pencil className="size-4" />
                          Modifica etichetta
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!canDeleteFields}
                          onClick={() => deleteCampo(campo.nome)}
                        >
                          <Trash2 className="size-4" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <Button variant="outline" onClick={openNew} disabled={!canCreateFields}>
          <Plus className="size-4" />
          Aggiungi campo
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi campo · {modulo}</DialogTitle>
            <DialogDescription>
              Definisci un nuovo campo personalizzato per il modulo {modulo}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campo-nome">Nome campo (snake_case)</Label>
              <Input
                id="campo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="es. valore_stimato"
                className={cn(
                  nome && !nomeValido && "border-destructive",
                )}
              />
              {nome && !nomeValido ? (
                <span className="text-xs text-destructive">
                  Solo lettere minuscole, numeri e underscore; deve iniziare con una lettera.
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campo-etichetta">Etichetta</Label>
              <Input
                id="campo-etichetta"
                value={etichetta}
                onChange={(e) => setEtichetta(e.target.value)}
                placeholder="es. Valore stimato (€)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo((v ?? "text") as CampoTipo)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => CAMPO_TIPO_LABEL[v as CampoTipo]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CAMPO_TIPI.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CAMPO_TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="campo-obbligatorio" className="cursor-pointer">
                Obbligatorio
              </Label>
              <Switch
                id="campo-obbligatorio"
                checked={obbligatorio}
                onCheckedChange={setObbligatorio}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Accesso default</Label>
              <Select
                value={accesso}
                onValueChange={(v) => setAccesso((v ?? "rw") as CampoAccesso)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => CAMPO_ACCESSO_LABEL[v as CampoAccesso]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACCESSO_OPZIONI.map((a) => (
                    <SelectItem key={a} value={a}>
                      {CAMPO_ACCESSO_LABEL[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Il campo verrà aggiunto alla matrice permessi per tutti i ruoli
              con l&apos;accesso default selezionato.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canCreateFields || !nomeValido || !etichetta.trim()}
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
