import type {
  AccessorioCommerciale,
  CatalogoCommerciale,
  MatriceAccumulo,
  PrezzoFotovoltaico,
  RegolaSconto,
} from "./types"

const BRANDS = ["SOLIS", "SINENG", "BYD", "SUNGROW", "SOLAX"] as const
const REQUIRED_KWP = [3, 4, 5, 6, 7, 8, 9, 10] as const

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase()
}

function numberIt(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  if (!/\d/.test(cleaned)) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function rowNumbers(line: string) {
  return line.split("|").map((cell) => numberIt(cell.trim()))
}

function numbersInText(value: string) {
  return [...value.matchAll(/\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?/g)]
    .map((match) => numberIt(match[0]))
    .filter((item): item is number => item != null)
}

function brandName(value: (typeof BRANDS)[number]) {
  return value === "SOLAX" ? "SolaX" : value[0] + value.slice(1).toLowerCase()
}

function findPreviousMatrix(previous: MatriceAccumulo[], brand: string) {
  return previous.find((item) => normalized(item.marca) === normalized(brand))
}

function priceAt(matrix: MatriceAccumulo | undefined, kwp: number, capacity: number) {
  if (!matrix) return null
  const index = matrix.taglie.findIndex((item) => Math.abs(item - capacity) < 0.001)
  const value = index >= 0 ? matrix.prezzi[String(kwp)]?.[index] : null
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function extractNotes(lines: string[]) {
  const interesting = [
    /ECCETTO/i,
    /BATTERIE? DA 5 KWH/i,
    /POTENZE INFERIORI/i,
    /10 KWP/i,
    /SECONDO INVERTER/i,
    /% DI SCONTO/i,
    /^EPS\b/i,
  ]
  return [...new Set(lines.filter((line) => interesting.some((pattern) => pattern.test(normalized(line)))))]
    .join("\n")
}

function extractDiscounts(lines: string[], previous: RegolaSconto[]) {
  const text = normalized(lines.join("\n"))
  const all = text.match(/(\d+(?:[,.]\d+)?)% DI SCONTO SU TUTTE/)
  const ranges = [...text.matchAll(/(\d+(?:[,.]\d+)?)% DI SCONTO DA (\d+(?:[,.]\d+)?) A (\d+(?:[,.]\d+)?)\s*KWP/g)]
  if (!all && ranges.length === 0) return previous
  const epsValues = lines
    .filter((line) => /^EPS\b/i.test(normalized(line)))
    .flatMap((line) => rowNumbers(line).filter((value): value is number => value != null && value >= 100 && value <= 2000))
  const zoneAEps = epsValues[0] ?? previous.find((rule) => rule.zona === "A")?.eps_prezzo ?? 0
  const zoneBEps = epsValues.find((value) => value !== zoneAEps) ?? previous.find((rule) => rule.zona === "B")?.eps_prezzo ?? 0
  const result: RegolaSconto[] = []
  if (all) {
    result.push({
      zona: "A",
      kwp_min: 3,
      kwp_max: 10,
      percentuale: Number(all[1].replace(",", ".")),
      eps_prezzo: zoneAEps,
      eps_omaggiabile: false,
    })
  }
  for (const match of ranges) {
    result.push({
      zona: "B",
      kwp_min: Number(match[2].replace(",", ".")),
      kwp_max: Number(match[3].replace(",", ".")),
      percentuale: Number(match[1].replace(",", ".")),
      eps_prezzo: zoneBEps,
      eps_omaggiabile: text.includes("OMAGGIABILE"),
    })
  }
  const unique = result.filter((rule, index, rules) => rules.findIndex((candidate) =>
    candidate.zona === rule.zona && candidate.kwp_min === rule.kwp_min && candidate.kwp_max === rule.kwp_max,
  ) === index)
  return unique.length > 0 ? unique : previous
}

function extractAccessories(lines: string[], previous: AccessorioCommerciale[]) {
  const result = structuredClone(previous)
  const definitions = [
    { pattern: /ZAVORRE A VELA/i, name: "Zavorre a vela", unit: "€/kWp" },
    { pattern: /^ZAVORRE(?:\s*\||$)/i, name: "Zavorre", unit: "€/kWp" },
    { pattern: /WALL BOX/i, name: "Wall Box SolaxPower / Sungrow", unit: "€" },
    { pattern: /OTTIMIZZATORI.*TIGO/i, name: "Ottimizzatori Tigo", unit: "€/kWp" },
    { pattern: /TIGO CLOUD CONNECT/i, name: "Tigo Cloud Connect", unit: "€" },
    { pattern: /SECONDO INVERTER/i, name: "Secondo inverter in parallelo", unit: "€" },
  ]
  for (const definition of definitions) {
    const line = lines.find((candidate) => definition.pattern.test(normalized(candidate)))
    if (!line) continue
    const normalizedLine = normalized(line)
    const match = normalizedLine.match(definition.pattern)
    const values = match?.index == null
      ? []
      : numbersInText(normalizedLine.slice(match.index + match[0].length)).filter((value) => value > 0)
    if (values.length === 0) continue
    const existing = result.find((item) => normalized(item.nome) === normalized(definition.name))
    const item: AccessorioCommerciale = {
      nome: definition.name,
      prezzo: values[0],
      prezzo_combo: values[1] ?? existing?.prezzo_combo ?? null,
      unita: definition.unit,
      scontabile: existing?.scontabile ?? !/WALL BOX|CLOUD CONNECT|SECONDO INVERTER/i.test(definition.name),
    }
    if (existing) Object.assign(existing, item)
    else result.push(item)
  }
  return result
}

/**
 * Converte il PDF commerciale nella matrice finale usata dal CRM.
 * Le righe esplicite del PDF contengono il totale FV + accumulo; nel CRM si
 * salva il sovrapprezzo accumulo. Le righe mancanti vengono proiettate dalla
 * logica commerciale dell'ultima matrice pubblicata (marca/capacita), non dai
 * suoi prezzi: in questo modo restano valide le eccezioni di marca, mentre i
 * nuovi importi arrivano sempre dal nuovo PDF.
 */
export function parseListinoCommerciale(
  testo: string,
  previous: Pick<CatalogoCommerciale, "fotovoltaico" | "accumuli" | "accessori" | "sconti">,
) {
  const previousPhotovoltaic = new Map(previous.fotovoltaico.map((row) => [row.kwp, row.prezzo]))
  const photovoltaic = new Map<number, number>()
  const lines = testo.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  let inBaseTable = false
  let parsedBase = 0

  for (const line of lines) {
    const label = normalized(line.replace(/\|/g, " "))
    if (label.includes("SENZA ACCUMULO")) { inBaseTable = true; continue }
    if (!inBaseTable || !line.includes("|")) continue
    const values = rowNumbers(line)
    if (values[0] != null && REQUIRED_KWP.includes(values[0] as (typeof REQUIRED_KWP)[number]) && values[1] != null && values[1] > 1000) {
      photovoltaic.set(values[0], values[1])
      parsedBase++
    }
  }

  const matrices: MatriceAccumulo[] = []
  const explicitRows = new Map<string, Set<number>>()
  let brand: string | null = null
  let capacities: number[] = []
  let baseMode = false
  let parsedBattery = 0

  for (const line of lines) {
    const label = normalized(line.replace(/\|/g, " "))
    const foundBrand = BRANDS.find((item) => label === item)
    if (foundBrand) {
      brand = brandName(foundBrand)
      baseMode = false
      capacities = []
      continue
    }
    if (label.includes("SENZA ACCUMULO")) {
      baseMode = true
      brand = null
      capacities = []
      continue
    }
    if (/^KWP\s+/.test(label) || normalized(line.split("|")[0] ?? "") === "KWP") {
      capacities = rowNumbers(line).slice(1).filter((item): item is number => item != null && item > 0 && item <= 100)
      continue
    }
    if (baseMode || !brand || capacities.length === 0 || !line.includes("|")) continue
    const numbers = rowNumbers(line)
    const kwp = numbers[0]
    if (kwp == null || !REQUIRED_KWP.includes(kwp as (typeof REQUIRED_KWP)[number])) continue
    const totals = numbers.slice(1, capacities.length + 1)
    if (totals.length !== capacities.length || totals.some((item) => item == null)) continue
    const base = photovoltaic.get(kwp)
    if (base == null) continue

    let matrix = matrices.find((item) => normalized(item.marca) === normalized(brand!))
    if (!matrix) {
      const old = findPreviousMatrix(previous.accumuli, brand)
      const mergedCapacities = [...new Set([...(old?.taglie ?? []), ...capacities])].sort((a, b) => a - b)
      matrix = {
        marca: brand,
        garanzia_anni: old?.garanzia_anni ?? null,
        ip: old?.ip ?? null,
        tensione: old?.tensione ?? null,
        taglie: mergedCapacities,
        prezzi: {},
      }
      matrices.push(matrix)
    }
    const values = matrix.taglie.map((capacity) => {
      const sourceIndex = capacities.findIndex((item) => Math.abs(item - capacity) < 0.001)
      if (sourceIndex >= 0) return Math.max(0, (totals[sourceIndex] as number) - base)
      const old = findPreviousMatrix(previous.accumuli, brand!)
      const oldIndex = old?.taglie.findIndex((item) => Math.abs(item - capacity) < 0.001) ?? -1
      const referenceIndex = capacities.findIndex((item) => item >= capacity)
      const sourceCapacity = capacities[referenceIndex >= 0 ? referenceIndex : capacities.length - 1]
      const sourceValue = (totals[referenceIndex >= 0 ? referenceIndex : totals.length - 1] as number) - base
      if (old && oldIndex >= 0) {
        const oldSource = priceAt(old, kwp, sourceCapacity)
        const oldTarget = priceAt(old, kwp, capacity)
        if (oldSource != null && oldTarget != null) return Math.max(0, sourceValue + oldTarget - oldSource)
      }
      return Math.max(0, sourceValue)
    })
    matrix.prezzi[String(kwp)] = values
    const key = normalized(brand)
    const rows = explicitRows.get(key) ?? new Set<number>()
    rows.add(kwp)
    explicitRows.set(key, rows)
    parsedBattery += capacities.length
  }

  const baseRows = REQUIRED_KWP.map((kwp) => ({ kwp, prezzo: photovoltaic.get(kwp) }))
  if (baseRows.some((row) => row.prezzo == null)) {
    throw new Error("Listino non pubblicato: la tabella FV deve contenere tutte le taglie da 3 a 10 kWp")
  }

  for (const matrix of matrices) {
    const rows = explicitRows.get(normalized(matrix.marca)) ?? new Set<number>()
    const anchors = [...rows].sort((a, b) => a - b)
    if (anchors.length === 0) continue
    const old = findPreviousMatrix(previous.accumuli, matrix.marca)
    for (const kwp of REQUIRED_KWP) {
      if (rows.has(kwp)) continue
      const anchor = kwp < anchors[0] ? anchors[0] : anchors[anchors.length - 1]
      const anchorValues = matrix.prezzi[String(anchor)]
      matrix.prezzi[String(kwp)] = matrix.taglie.map((capacity, index) => {
        const anchorPrice = anchorValues[index]
        const oldTarget = priceAt(old, kwp, capacity)
        const oldAnchor = priceAt(old, anchor, capacity)
        const oldBaseTarget = previousPhotovoltaic.get(kwp)
        const oldBaseAnchor = previousPhotovoltaic.get(anchor)
        if (oldTarget != null && oldAnchor != null && oldBaseTarget != null && oldBaseAnchor != null) {
          const totalDelta = oldBaseTarget + oldTarget - oldBaseAnchor - oldAnchor
          return Math.max(0, Math.round((photovoltaic.get(anchor) ?? 0) + anchorPrice + totalDelta - (photovoltaic.get(kwp) ?? 0)))
        }
        // Regola generale: fuori dall'intervallo esplicito si usa il prezzo
        // accumulo della taglia FV disponibile piu vicina.
        return anchorPrice
      })
    }
  }

  if (matrices.length === 0 || matrices.some((matrix) =>
    REQUIRED_KWP.some((kwp) => matrix.prezzi[String(kwp)]?.length !== matrix.taglie.length || matrix.prezzi[String(kwp)].some((value) => !Number.isFinite(value) || value <= 0)),
  )) {
    throw new Error("Listino non pubblicato: matrice accumuli incompleta o non leggibile")
  }

  return {
    fotovoltaico: baseRows as PrezzoFotovoltaico[],
    accumuli: matrices,
    accessori: extractAccessories(lines, previous.accessori),
    sconti: extractDiscounts(lines, previous.sconti),
    note: extractNotes(lines),
    parsedBase,
    parsedBattery,
  }
}
