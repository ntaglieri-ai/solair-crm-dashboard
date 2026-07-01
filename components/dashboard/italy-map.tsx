"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"

// TopoJSON delle regioni italiane servito localmente (nessuna fetch esterna a runtime)
const ITALY_GEO = "/italy-regions.json"

export type DashboardMapMarker = {
  id: string
  nome: string
  coordinates: [number, number]
  leads: number
}

export function ItalyMap({ markers = [] }: { markers?: DashboardMapMarker[] }) {
  const maxLeads = Math.max(...markers.map((marker) => marker.leads), 1)
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-secondary/40">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 1600, center: [12.5, 42] }}
          className="h-full w-full"
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={ITALY_GEO}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="var(--secondary)"
                  stroke="var(--primary)"
                  strokeWidth={0.6}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "var(--accent)" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((marker) => {
            const radius = 6 + Math.round((marker.leads / maxLeads) * 5)
            return (
              <Marker key={marker.id} coordinates={marker.coordinates}>
                <circle
                  r={radius + 5}
                  fill="var(--teal)"
                  opacity={0.18}
                />
                <circle
                  r={radius}
                  fill="var(--teal)"
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
                <text
                  textAnchor="middle"
                  y={-radius - 6}
                  className="fill-foreground text-[9px] font-semibold"
                >
                  {marker.nome}
                </text>
              </Marker>
            )
          })}
        </ComposableMap>
        {markers.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md bg-card/90 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm">
            Configura le sedi in CRM Settings per visualizzarle sulla mappa.
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-teal" />
        <span className="text-xs text-muted-foreground">Sedi operative</span>
      </div>
    </div>
  )
}
