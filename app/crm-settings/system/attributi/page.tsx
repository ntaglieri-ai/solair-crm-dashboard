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
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"
import { tableForCrmModule } from "@/lib/crm-settings/schema-admin"

const ACCESSO_OPZIONI: CampoAccesso[] = ["no_access", "r", "rw"]

function moduloKey(modulo: ModuloAttributi) {
  return modulo.toLowerCase()
}

export default function AttributiPage() {
  const permissions = usePermissions()
  const [modulo, setModulo] = useState<ModuloAttributi>("Lead")
  const [tutti, setTutti, store] = usePersistentSystemSetting<
    Record<ModuloAttributi, CampoRecord[]>
  >(
    "system.attributi",
    structuredClone(campiPerModulo),
  )
  const [dialogOpen, setDialogOpen] = useState(false)

  // Stato modale nuovo campo.
  const [nome, setNome] = useState("")
  const [etichetta, setEtichetta] = useState("")
  const [tipo, setTipo] = useState<CampoTipo>("text")
  const [obbligatorio, setObbligatorio] = useState(false)
  const [accesso, setAccesso] = useState<CampoAccesso>("rw")
  const [editingCampo, setEditingCampo] = useState<CampoRecord | null>(null)
  const [editingEtichetta, setEditingEtichetta] = useState("")
  const [apiError, setApiError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const campi = tutti[modulo]
  const nomeValido = /^[a-z][a-z0-9_]*$/.test(nome)
  const currentModule = moduloKey(modulo)
  const canManageSchema = permissions.canAction("crm_settings.system.schema.manage")
  const canCreateFields =
    canManageSchema && permissions.canAction(`${currentModule}.fields.create`)
  const canEditFields =
    canManageSchema && permissions.canAction(`${currentModule}.fields.edit`)
  const canDeleteFields =
    canManageSchema && permissions.canAction(`${currentModule}.fields.delete`)
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

  async function persistCampoPatch(nomeCampo: string, patch: Partial<CampoRecord>) {
    const campo = campi.find((item) => item.nome === nomeCampo)
    updateCampo(nomeCampo, patch)
    if (!campo || campo.sistema) return

    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/columns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: modulo,
        column: nomeCampo,
        label: patch.etichetta,
        required: patch.obbligatorio,
        visible: patch.visibile,
      }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Aggiornamento campo non riuscito.")
    }
  }

  async function deleteCampo(nomeCampo: string) {
    if (!canDeleteFields) return
    setPending(true)
    setApiError(null)
    const response = await fetch(
      `/api/crm-settings/schema/columns?module=${encodeURIComponent(modulo)}&column=${encodeURIComponent(nomeCampo)}`,
      { method: "DELETE" },
    )
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Eliminazione colonna non riuscita.")
      return
    }
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

  async function handleSave() {
    if (!canCreateFields || !nomeValido || !etichetta.trim()) return
    setPending(true)
    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: modulo,
        name: nome,
        label: etichetta.trim(),
        type: tipo,
        required: obbligatorio,
        visible: true,
      }),
    })
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Creazione colonna non riuscita.")
      return
    }
    setTutti((prev) => ({
      ...prev,
      [modulo]: [
        ...prev[modulo],
        {
          nome,
          etichetta: etichetta.trim(),
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

  function openEdit(campo: CampoRecord) {
    if (!canEditFields) return
    setEditingCampo(campo)
    setEditingEtichetta(campo.etichetta)
  }

  async function saveEdit() {
    if (!editingCampo || !editingEtichetta.trim()) return
    await persistCampoPatch(editingCampo.nome, { etichetta: editingEtichetta.trim() })
    setEditingCampo(null)
    setEditingEtichetta("")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Campi personalizzati"
        description={
          pending || store.saving
            ? "Salvataggio schema CRM..."
            : `Crea e governa colonne reali Supabase per ${tableForCrmModule(modulo) ?? modulo}, con metadati usati dal permission engine.`
        }
      />

      {apiError || store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {apiError ?? store.error}
        </p>
      ) : null}

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
                      void persistCampoPatch(campo.nome, { obbligatorio: v })
                    }
                    aria-label={`${campo.etichetta} obbligatorio`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={campo.visibile}
                    disabled={!canManageVisibility}
                    onCheckedChange={(v) =>
                      void persistCampoPatch(campo.nome, { visibile: v })
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
                          onClick={() => openEdit(campo)}
                        >
                          <Pencil className="size-4" />
                          Modifica etichetta
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!canDeleteFields}
                          onClick={() => void deleteCampo(campo.nome)}
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
        <Button variant="outline" onClick={openNew} disabled={!canCreateFields || pending}>
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
              con l&apos;accesso default selezionato e alla tabella Supabase del modulo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canCreateFields || pending || !nomeValido || !etichetta.trim()}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingCampo !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCampo(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica etichetta</DialogTitle>
            <DialogDescription>
              Aggiorna il nome visualizzato del campo senza cambiare la chiave tecnica.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="campo-edit-etichetta">Etichetta campo</Label>
            <Input
              id="campo-edit-etichetta"
              value={editingEtichetta}
              onChange={(e) => setEditingEtichetta(e.target.value)}
            />
            {editingCampo ? (
              <span className="text-xs text-muted-foreground">
                Chiave tecnica: <code>{editingCampo.nome}</code>
              </span>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCampo(null)}>
              Annulla
            </Button>
            <Button
              onClick={saveEdit}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Salva modifica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
