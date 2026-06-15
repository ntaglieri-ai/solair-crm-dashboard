"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import type { Lead } from "@/lib/mock-data"

const ITALY_GEO = "/italy-regions.json"

// coordinate approssimate delle sedi Solair
const SEDE_COORDS: Record<string, [number, number]> = {
  torino: [7.68, 45.07],
  treviso: [12.24, 45.66],
  "porto-sant-elpidio": [13.75, 43.25],
  catania: [15.08, 37.5],
  giarre: [15.18, 37.73],
}

export function LeadMiniMap({ lead }: { lead: Lead }) {
  const point = SEDE_COORDS[lead.sede] ?? [12.5, 42]
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
            {lead.citta}
          </text>
        </Marker>
      </ComposableMap>
    </div>
  )
}
