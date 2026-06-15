"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import type { Lead, SedeLabel } from "@/lib/mock-data"

const ITALY_GEO = "/italy-regions.json"

// coordinate approssimate delle sedi Solair (chiave = label Sede Zoho)
const SEDE_COORDS: Record<SedeLabel, [number, number]> = {
  Torino: [7.68, 45.07],
  Treviso: [12.24, 45.66],
  "Porto Sant'Elpidio": [13.75, 43.25],
  Catania: [15.08, 37.5],
  "Giarre (CT)": [15.18, 37.73],
}

export function LeadMiniMap({ lead }: { lead: Lead }) {
  const point = SEDE_COORDS[lead.Sede] ?? [12.5, 42]
  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-border bg-secondary/40">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 1500, center: [12.5, 42] }}
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
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        <Marker coordinates={point}>
          <circle r={11} fill="var(--teal)" opacity={0.2} />
          <circle r={6} fill="var(--teal)" stroke="var(--card)" strokeWidth={1.5} />
          <text
            textAnchor="middle"
            y={-11}
            className="fill-foreground text-[9px] font-semibold"
          >
            {lead["Città"]}
          </text>
        </Marker>
      </ComposableMap>
    </div>
  )
}
