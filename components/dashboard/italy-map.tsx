"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import { cn } from "@/lib/utils"
import { MAP_MARKERS, type MapMarker } from "@/lib/mock-data"

// TopoJSON delle regioni italiane (sorgente pubblica, nessuna API a runtime)
const ITALY_GEO =
  "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/italy/italy-regions.json"

const INTENSITY_COLOR: Record<MapMarker["intensity"], string> = {
  caldo: "var(--destructive)",
  medio: "var(--warning)",
  freddo: "var(--info)",
}

const INTENSITY_SIZE: Record<MapMarker["intensity"], number> = {
  caldo: 9,
  medio: 7,
  freddo: 5,
}

const LEGENDA: { label: string; key: MapMarker["intensity"] }[] = [
  { label: "Lead caldi", key: "caldo" },
  { label: "Lead medi", key: "medio" },
  { label: "Lead freddi", key: "freddo" },
]

export function ItalyMap() {
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
                  fill="var(--card)"
                  stroke="var(--border)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "var(--secondary)" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {MAP_MARKERS.map((m) => {
            // coordinate approssimate delle 5 sedi Solair
            const coords: Record<string, [number, number]> = {
              torino: [7.68, 45.07],
              treviso: [12.24, 45.66],
              porto: [13.75, 43.25],
              catania: [15.08, 37.5],
              giarre: [15.18, 37.73],
            }
            const point = coords[m.id]
            if (!point) return null
            return (
              <Marker key={m.id} coordinates={point}>
                <circle
                  r={INTENSITY_SIZE[m.intensity] + 4}
                  fill={INTENSITY_COLOR[m.intensity]}
                  opacity={0.18}
                />
                <circle
                  r={INTENSITY_SIZE[m.intensity]}
                  fill={INTENSITY_COLOR[m.intensity]}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
                <text
                  textAnchor="middle"
                  y={-INTENSITY_SIZE[m.intensity] - 5}
                  className="fill-foreground text-[9px] font-semibold"
                >
                  {m.citta}
                </text>
              </Marker>
            )
          })}
        </ComposableMap>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4">
        {LEGENDA.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span
              className={cn("size-2.5 rounded-full")}
              style={{ backgroundColor: INTENSITY_COLOR[item.key] }}
            />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
