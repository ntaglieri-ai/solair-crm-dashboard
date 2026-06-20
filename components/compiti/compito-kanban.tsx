"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  type Compito,
  type StatoCompito,
  STATO_COMPITO_ORDER,
  isCompitoScaduto,
} from "@/lib/mock-data"
import { PrioritaBadge, CompitoAvatar } from "./compito-utils"
import { IconClock } from "@tabler/icons-react"

function CompitoCard({
  compito,
  onDragStart,
}: {
  compito: Compito
  onDragStart: (id: string) => void
}) {
  const router = useRouter()
  const scaduto = isCompitoScaduto(compito)
  return (
    <article
      draggable
      onDragStart={() => onDragStart(compito.id)}
      onClick={() => router.push(`/compiti/${compito.id}`)}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <p
        className={cn(
          "text-pretty text-sm font-medium text-foreground",
          compito.Stato === "Completato" && "text-muted-foreground line-through",
        )}
      >
        {compito.Oggetto}
      </p>
      {compito["Correlato a"] && (
        <p className="truncate text-xs text-info">
          {compito["Correlato a"].nome}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <PrioritaBadge priorita={compito.Priorità} />
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs tabular-nums",
            scaduto ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          <IconClock size={13} stroke={1.8} />
          {compito["Data di scadenza"]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 border-t border-border pt-2">
        <CompitoAvatar nome={compito["Proprietario del compito"]} size={20} />
        <span className="truncate text-xs text-muted-foreground">
          {compito["Proprietario del compito"]}
        </span>
      </div>
    </article>
  )
}

export function CompitoKanban({
  compiti,
  onMove,
}: {
  compiti: Compito[]
  onMove: (id: string, stato: StatoCompito) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<StatoCompito | null>(null)

  const handleDrop = (stato: StatoCompito) => {
    if (dragId) onMove(dragId, stato)
    setDragId(null)
    setOverCol(null)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATO_COMPITO_ORDER.map((stato) => {
        const cards = compiti.filter((c) => c.Stato === stato)
        return (
          <section
            key={stato}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(stato)
            }}
            onDragLeave={() => setOverCol((s) => (s === stato ? null : s))}
            onDrop={() => handleDrop(stato)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-secondary/40 transition-colors",
              overCol === stato && "border-navy bg-navy/5",
            )}
          >
            <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-sm font-semibold text-foreground">
                {stato}
              </span>
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-card text-[11px] font-semibold tabular-nums text-muted-foreground">
                {cards.length}
              </span>
            </header>
            <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
              {cards.map((c) => (
                <CompitoCard key={c.id} compito={c} onDragStart={setDragId} />
              ))}
              {cards.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Trascina qui
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
