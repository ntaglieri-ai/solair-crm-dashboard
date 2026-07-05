"use client"

import { useMemo, useState } from "react"
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps"
import { Minus, Plus, RotateCcw } from "lucide-react"

const ITALY_GEO = "/italy-regions.json"

export type DashboardMapMarker = {
  id: string
  nome: string
  coordinates: [number, number]
  leads: number
}

type RegionDatum = { region: string; count: number }

const COLOR_STOPS = ["#edf2f8", "#ffe2a8", "#ffb25c", "#ef6a47", "#b8273d"]

export function ItalyMap({
  markers = [],
  regionData = [],
}: {
  markers?: DashboardMapMarker[]
  regionData?: RegionDatum[]
}) {
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>([12.5, 42])
  const [hovered, setHovered] = useState<{ name: string; count: number } | null>(null)
  const counts = useMemo(
    () => new Map(regionData.map((item) => [item.region, item.count])),
    [regionData],
  )
  const max = Math.max(...regionData.map((item) => item.count), 1)
  const total = regionData.reduce((sum, item) => sum + item.count, 0)

  function colorFor(count: number) {
    if (count === 0) return COLOR_STOPS[0]
    const ratio = count / max
    return COLOR_STOPS[Math.min(COLOR_STOPS.length - 1, Math.ceil(ratio * 4))]
  }

  function changeZoom(next: number) {
    setZoom(Math.max(1, Math.min(2.2, next)))
  }

  function reset() {
    setZoom(1)
    setCenter([12.5, 42])
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-[#d9e2ef] bg-[#f8fbff]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 1600, center: [12.5, 42] }}
          className="h-full w-full"
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            minZoom={1}
            maxZoom={2.2}
            filterZoomEvent={(event) => {
              const input = event as unknown as { type?: string; button?: number }
              return input.type !== "wheel" && !input.button
            }}
            onMoveEnd={({ coordinates, zoom: nextZoom }) => {
              setCenter(coordinates as [number, number])
              setZoom(nextZoom)
            }}
          >
            <Geographies geography={ITALY_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name = String(geo.properties?.reg_name ?? "")
                  const count = counts.get(name) ?? 0
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={colorFor(count)}
                      stroke="#ffffff"
                      strokeWidth={0.85 / zoom}
                      onMouseEnter={() => setHovered({ name, count })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        default: { outline: "none", transition: "fill 160ms ease" },
                        hover: { outline: "none", fill: "#7c2035", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                    />
                  )
                })
              }
            </Geographies>
            {markers.map((marker) => (
              <Marker key={marker.id} coordinates={marker.coordinates}>
                <circle r={5 / zoom} fill="#20a47a" stroke="#fff" strokeWidth={1.5 / zoom} />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg border border-border bg-white p-1 shadow-md">
          <button type="button" aria-label="Aumenta zoom" onClick={() => changeZoom(zoom + 0.35)} className="map-control">
            <Plus />
          </button>
          <button type="button" aria-label="Riduci zoom" onClick={() => changeZoom(zoom - 0.35)} className="map-control">
            <Minus />
          </button>
          <button type="button" aria-label="Reimposta mappa" onClick={reset} className="map-control">
            <RotateCcw />
          </button>
        </div>

        {hovered ? (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-white px-4 py-3 shadow-lg">
            <p className="text-sm font-bold text-foreground">{hovered.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hovered.count.toLocaleString("it-IT")} lead
              {total > 0 ? ` · ${Math.round((hovered.count / total) * 100)}%` : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Distribuzione lead</p>
          <div className="mt-1 flex items-center gap-1">
            {COLOR_STOPS.map((color) => (
              <span key={color} className="h-2.5 w-8 rounded-sm" style={{ background: color }} />
            ))}
            <span className="ml-1 text-[11px] text-muted-foreground">più intensa</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span className="size-2.5 rounded-full bg-[#20a47a]" />
          Sedi operative
        </div>
      </div>
    </div>
  )
}
