"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { Compito, StatoCompito } from "@/lib/mock-data"
import { STATO_COMPITO_ORDER } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react"
import { StatoBadge, PrioritaBadge, CompitoAvatar } from "./compito-utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CompitoDetailHeader({ compito }: { compito: Compito }) {
  const router = useRouter()
  const [stato, setStato] = useState<StatoCompito>(compito.Stato)
  const [statoPending, setStatoPending] = useState(false)

  const changeStato = async (s: StatoCompito) => {
    if (s === stato || statoPending) return
    const prev = stato
    setStato(s)
    setStatoPending(true)
    try {
      const res = await fetch(`/api/compiti/${compito.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Stato: s }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      router.refresh()
    } catch {
      setStato(prev)
      toast.error("Errore nell'aggiornamento dello stato")
    } finally {
      setStatoPending(false)
    }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <button
          onClick={() => router.push("/compiti")}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft size={18} stroke={1.8} />
          Compiti
        </button>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
            <IconPencil size={15} stroke={1.8} />
            Modifica
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-label="Altre azioni"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <IconDots size={16} stroke={1.8} />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Duplica compito</DropdownMenuItem>
              <DropdownMenuItem>Crea follow-up</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <IconTrash size={15} stroke={1.8} />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-5 pt-1 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <CompitoAvatar nome={compito["Proprietario del compito"]} size={48} />
          <div className="min-w-0">
            <h1 className="text-pretty text-xl font-semibold leading-tight text-foreground">
              {compito.Oggetto}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <IconClock size={15} stroke={1.8} />
                Scadenza {compito["Data di scadenza"]}
              </span>
              {compito["Correlato a"] && (
                <span>
                  Correlato a{" "}
                  <Link
                    href={
                      compito["Correlato a"].tipo === "Lead"
                        ? `/leads/${compito["Correlato a"].id}`
                        : `/clienti/${compito["Correlato a"].id}`
                    }
                    className="font-medium text-info hover:underline"
                  >
                    {compito["Correlato a"].nome}
                  </Link>
                </span>
              )}
              <span>Proprietario {compito["Proprietario del compito"]}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PrioritaBadge priorita={compito.Priorità} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-busy={statoPending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full transition-opacity",
                    statoPending && "pointer-events-none opacity-60",
                  )}
                >
                  <StatoBadge stato={stato} />
                  <IconChevronDown
                    size={14}
                    stroke={2}
                    className="text-muted-foreground"
                  />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              {STATO_COMPITO_ORDER.map((s) => (
                <DropdownMenuItem key={s} onClick={() => changeStato(s)}>
                  <span className="flex w-4 items-center">
                    {s === stato && <IconCheck size={15} stroke={2} />}
                  </span>
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
