"use client"

import { useRouter } from "next/navigation"
import { MoreHorizontal, ExternalLink, UserCheck, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Lead, SEDI, nomeCompleto } from "@/lib/mock-data"
import {
  LeadAvatar,
  StatusBadge,
  OrigineBadge,
  ScoreBar,
} from "./lead-utils"

const SEDE_LABEL = SEDI.reduce<Record<string, string>>((acc, s) => {
  acc[s.id] = s.label
  return acc
}, {})

export function LeadTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onConvert,
  onDelete,
}: {
  leads: Lead[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onConvert: (lead: Lead) => void
  onDelete: (lead: Lead) => void
}) {
  const router = useRouter()
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden md:table-cell">Città</TableHead>
            <TableHead className="hidden lg:table-cell">Configurazione</TableHead>
            <TableHead className="hidden xl:table-cell">Origine</TableHead>
            <TableHead className="hidden xl:table-cell">Sede</TableHead>
            <TableHead className="hidden lg:table-cell">Commerciale</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="hidden md:table-cell">Creato</TableHead>
            <TableHead className="w-10 text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow
              key={lead.id}
              onClick={() => router.push(`/leads/${lead.id}`)}
              className="cursor-pointer"
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(lead.id)}
                  onCheckedChange={() => onToggle(lead.id)}
                  aria-label={`Seleziona ${nomeCompleto(lead)}`}
                />
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-3">
                  <LeadAvatar lead={lead} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {nomeCompleto(lead)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {lead.email}
                    </span>
                  </div>
                </div>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-foreground">{lead.citta}</span>
                <span className="text-xs text-muted-foreground"> ({lead.provincia})</span>
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">
                  {lead.configurazione}
                </span>
              </TableCell>

              <TableCell className="hidden xl:table-cell">
                <OrigineBadge origine={String(lead.origine)} />
              </TableCell>

              <TableCell className="hidden xl:table-cell">
                <span className="text-sm text-muted-foreground">
                  {SEDE_LABEL[lead.sede]}
                </span>
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">
                  {lead.commerciale ?? "—"}
                </span>
              </TableCell>

              <TableCell>
                <StatusBadge status={lead.status} />
              </TableCell>

              <TableCell>
                <ScoreBar score={lead.score} />
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <span className="text-xs text-muted-foreground">
                  {lead.dataCreazione}
                </span>
              </TableCell>

              <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" aria-label="Azioni">
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
                        <ExternalLink data-icon="inline-start" />
                        Apri
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onConvert(lead)}>
                        <UserCheck data-icon="inline-start" />
                        Converti a cliente
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(lead)}>
                        <Trash2 data-icon="inline-start" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}

          {leads.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                Nessun lead corrisponde ai filtri selezionati.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
