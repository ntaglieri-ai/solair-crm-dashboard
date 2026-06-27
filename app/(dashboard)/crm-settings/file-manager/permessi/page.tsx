"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { StorageRoleBadge } from "@/components/file-manager/storage-role-badge"
import { Lock } from "lucide-react"
import {
  PERMESSI_STORAGE,
  CARTELLE_VISIBILI_OPTIONS,
  type PermessoStorage,
  type CartelleVisibili,
} from "@/lib/file-manager-data"

export default function PermessiPage() {
  const [permessi, setPermessi] = useState<PermessoStorage[]>(PERMESSI_STORAGE)

  function update(ruolo: string, patch: Partial<PermessoStorage>) {
    setPermessi((prev) =>
      prev.map((p) => (p.ruolo === ruolo ? { ...p, ...patch } : p)),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Permessi storage per ruolo"
        description="Configura cosa può fare ogni ruolo sullo storage Nextcloud."
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Ruolo</TableHead>
                <TableHead className="w-52">Cartelle visibili</TableHead>
                <TableHead className="text-center">Upload</TableHead>
                <TableHead className="text-center">Download</TableHead>
                <TableHead className="text-center">Elimina</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permessi.map((p) => (
                <TableRow key={p.ruolo}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StorageRoleBadge ruolo={p.ruolo} />
                      {p.locked ? (
                        <Lock
                          className="size-3.5 text-muted-foreground"
                          aria-label="Ruolo non modificabile"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.cartelle}
                      onValueChange={(v) =>
                        update(p.ruolo, {
                          cartelle: (v ?? "Nessuna") as CartelleVisibili,
                        })
                      }
                      disabled={p.locked}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARTELLE_VISIBILI_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={p.upload}
                      onCheckedChange={(c) => update(p.ruolo, { upload: c })}
                      disabled={p.locked}
                      aria-label={`Upload per ${p.ruolo}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={p.download}
                      onCheckedChange={(c) => update(p.ruolo, { download: c })}
                      disabled={p.locked}
                      aria-label={`Download per ${p.ruolo}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={p.elimina}
                      onCheckedChange={(c) => update(p.ruolo, { elimina: c })}
                      disabled={p.locked}
                      aria-label={`Elimina per ${p.ruolo}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" className="bg-teal text-teal-foreground hover:bg-teal/90">
          Salva permessi storage
        </Button>
      </div>
    </div>
  )
}
