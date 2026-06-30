"use client"

import { useMemo, useState } from "react"
import {
  getKpiData,
  getMiniStats,
  getHotLeads,
  type SedeId,
} from "@/lib/mock-data"
import { SedeFilter } from "@/components/dashboard/sede-filter"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { MiniStats } from "@/components/dashboard/mini-stats"
import { HotLeads } from "@/components/dashboard/hot-leads"
import { Pipeline } from "@/components/dashboard/pipeline"
import { LiveFeed } from "@/components/dashboard/live-feed"
import { PermissionPageGuard } from "@/lib/permissions/client-guard"

export default function DashboardPage() {
  const [sede, setSede] = useState<SedeId>("all")

  const kpi = useMemo(() => getKpiData(sede), [sede])
  const mini = useMemo(() => getMiniStats(sede), [sede])
  const leads = useMemo(() => getHotLeads(sede), [sede])

  return (
    <PermissionPageGuard page="dashboard">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      {/* Header dashboard + filtro sede */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-foreground">Panoramica</h2>
          <p className="text-sm text-muted-foreground">
            Stato lead, clienti e pipeline in tempo reale
          </p>
        </div>
        <SedeFilter value={sede} onChange={setSede} />
      </div>

      {/* KPI */}
      <KpiCards data={kpi} />

      {/* Mini stat */}
      <MiniStats data={mini} />

      {/* Lead caldi + mappa */}
      <HotLeads leads={leads} />

      {/* Pipeline + Feed */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Pipeline />
        </div>
        <div className="xl:col-span-1">
          <LiveFeed />
        </div>
      </div>
      </div>
    </PermissionPageGuard>
  )
}
