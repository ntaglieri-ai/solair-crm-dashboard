"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  IconBrandGoogleDrive,
  IconCloud,
  IconCircleOff,
  IconCircleCheck,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_LABEL, type UserRole } from "@/lib/mock-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

type Provider = "none" | "google" | "zoho"

const PROVIDERS: {
  id: Provider
  label: string
  description: string
  icon: typeof IconCloud
}[] = [
  {
    id: "none",
    label: "Nessuno",
    description: "Archiviazione documenti non collegata",
    icon: IconCircleOff,
  },
  {
    id: "google",
    label: "Google Drive",
    description: "Sincronizza i documenti su Google Drive",
    icon: IconBrandGoogleDrive,
  },
  {
    id: "zoho",
    label: "Zoho WorkDrive",
    description: "Sincronizza i documenti su Zoho WorkDrive",
    icon: IconCloud,
  },
]

const PERMESSI = ["Nessuno", "Lettura", "Lettura + Scrittura"] as const
const RUOLI: UserRole[] = ["admin", "commerciale", "tecnico"]

export function FileManagerSection() {
  const [provider, setProvider] = useState<Provider>("none")
  const [connected, setConnected] = useState(false)
  const [folders, setFolders] = useState<Record<string, string>>({
    Lead: "",
    Clienti: "",
  })
  const [permessi, setPermessi] = useState<Record<UserRole, string>>({
    admin: "Lettura + Scrittura",
    commerciale: "Lettura",
    tecnico: "Nessuno",
  })

  const connectedProvider = PROVIDERS.find((p) => p.id === provider)

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="File manager"
        description="Collega un provider di archiviazione per sincronizzare i documenti del CRM."
      />

      {/* Selezione provider */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PROVIDERS.map((p) => {
          const Icon = p.icon
          const isSelected = provider === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProvider(p.id)
                setConnected(false)
              }}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                isSelected
                  ? "border-navy bg-navy/5 ring-1 ring-navy"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  isSelected
                    ? "bg-navy text-navy-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon size={20} stroke={1.8} />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {p.label}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {p.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Stato connessione */}
      {provider !== "none" ? (
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                Connessione a {connectedProvider?.label}
              </span>
              {connected ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success/10 px-2 text-xs font-medium text-success">
                  <IconCircleCheck size={13} stroke={2} />
                  Connesso
                </span>
              ) : (
                <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
                  Non connesso
                </span>
              )}
            </div>
            {connected ? (
              <Button
                variant="outline"
                onClick={() => {
                  setConnected(false)
                  toast.success("Provider disconnesso")
                }}
              >
                Disconnetti
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setConnected(true)
                  toast.success(`Connesso a ${connectedProvider?.label}`)
                }}
              >
                Connetti
              </Button>
            )}
          </div>

          {connected ? (
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Account connesso
                </span>
                <span className="text-sm font-medium text-foreground">
                  documenti@solairgroup.it
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Ultima sincronizzazione
                </span>
                <span className="text-sm font-medium text-foreground">
                  23/06/2026 09:05
                </span>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Cartelle collegate per modulo */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Cartelle collegate per modulo
        </h3>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-muted-foreground">
                  Modulo
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Cartella associata
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(folders).map((modulo) => (
                <TableRow key={modulo}>
                  <TableCell className="font-medium text-foreground">
                    {modulo}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={folders[modulo]}
                      disabled={provider === "none"}
                      onChange={(e) =>
                        setFolders((prev) => ({
                          ...prev,
                          [modulo]: e.target.value,
                        }))
                      }
                      placeholder="/Solair CRM/…"
                      className="h-9 max-w-sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Permessi per ruolo */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Permessi per ruolo
        </h3>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-muted-foreground">
                  Ruolo
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">
                  Permesso
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RUOLI.map((r) => (
                <TableRow key={r}>
                  <TableCell className="font-medium text-foreground">
                    {ROLE_LABEL[r]}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={permessi[r]}
                      onValueChange={(v) =>
                        setPermessi((prev) => ({ ...prev, [r]: v }))
                      }
                    >
                      <SelectTrigger className="h-9 w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PERMESSI.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
