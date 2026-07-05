"use client"

import dynamic from "next/dynamic"
import type { DashboardMapMarker } from "./italy-map"

const ItalyMap = dynamic(
  () => import("./italy-map").then((module) => module.ItalyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] animate-pulse items-center justify-center rounded-lg bg-muted/60">
        <div className="h-48 w-36 rounded-[45%] bg-muted" />
      </div>
    ),
  },
)

export function LazyItalyMap({
  markers,
  regionData,
}: {
  markers: DashboardMapMarker[]
  regionData: Array<{ region: string; count: number }>
}) {
  return <ItalyMap markers={markers} regionData={regionData} />
}
