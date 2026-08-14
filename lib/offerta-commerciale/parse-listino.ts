import type {
  AccessorioCommerciale,
  MatriceAccumulo,
  PrezzoFotovoltaico,
  RegolaSconto,
} from "./types"

const REQUIRED_KWP = [3, 4, 5, 6, 7, 8, 9, 10] as const
const KNOWN_BRAND_NAMES: Record<string, string> = {
  BYD: "BYD",
  SINENG: "Sineng",
  SOLAX: "SolaX",
  SOLIS: "Solis",
  SUNGROW: "Sungrow",
}

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

function isCapacityHeader(line: string) {
  return normalized(line.split("|")[0] ?? "") === "KWP"
}

function displayBrandName(value: string) {
  const key = normalized(value)
  return KNOWN_BRAND_NAMES[key] ?? value.trim().toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
}

function findBrandHeaders(lines: string[]) {
  const headers = new Map<number, string>()
  for (let index = 0; index < lines.length - 1; index++) {
    const candidate = lines[index]
    const label = normalized(candidate)
    if (
      candidate.includes("|") ||
      label.includes("SENZA ACCUMULO") ||
      label.startsWith("LISTINO") ||
      label.startsWith("ZONA") ||
      !isCapacityHeader(lines[index + 1])
    ) continue
    headers.set(index, displayBrandName(candidate))
  }
  return headers
}

function extractBrandMetadata(lines: string[], headerIndex: number, nextHeaderIndex: number | undefined) {
  const section = normalized(lines.slice(headerIndex, nextHeaderIndex ?? lines.length).join("\n"))
  const warranty = section.match(/(\d+)\s*ANNI GARANZIA/)
  const ip = section.match(/\bIP\s*(\d+)\b/)
  return {
    garanzia_anni: warranty ? Number(warranty[1]) : null,
    ip: ip ? `IP${ip[1]}` : null,
    tensione: section.includes("ALTA TENSIONE") ? "alta" : section.includes("BASSA TENSIONE") ? "bassa" : null,
  }
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

function extractDiscounts(lines: string[]) {
  const text = normalized(lines.join("\n"))
  const all = text.match(/(\d+(?:[,.]\d+)?)% DI SCONTO SU TUTTE/)
  const ranges = [...text.matchAll(/(\d+(?:[,.]\d+)?)% DI SCONTO DA (\d+(?:[,.]\d+)?) A (\d+(?:[,.]\d+)?)\s*KWP/g)]
  const epsValues = lines
    .filter((line) => /^EPS\b/i.test(normalized(line)))
    .flatMap((line) => rowNumbers(line).filter((value): value is number => value != null && value >= 100 && value <= 2000))
  const zoneAEps = epsValues[0] ?? 0
  const zoneBEps = epsValues.find((value) => value !== zoneAEps) ?? 0
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
  return result.filter((rule, index, rules) => rules.findIndex((candidate) =>
    candidate.zona === rule.zona && candidate.kwp_min === rule.kwp_min && candidate.kwp_max === rule.kwp_max,
  ) === index)
}

function canonicalAccessoryName(value: string) {
  const clean = value
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s+/g, " ")
    .trim()
  const label = normalized(clean)
  if (label.includes("ZAVORRE A VELA")) return "Zavorre a vela"
  if (label === "ZAVORRE") return "Zavorre"
  if (label.includes("WALL BOX")) return "Wall Box SolaxPower / Sungrow"
  if (label.includes("OTTIMIZZATORI") && label.includes("TIGO")) return "Ottimizzatori Tigo"
  if (label.includes("TIGO CLOUD CONNECT")) return "Tigo Cloud Connect"
  if (label.includes("SECONDO INVERTER")) return "Secondo inverter in parallelo"
  return clean
}

function accessoryUnit(line: string) {
  return /\/\s*KWP/i.test(normalized(line)) ? "€/kWp" : "€"
}

function accessoryDiscountable(name: string) {
  const label = normalized(name)
  if (/WALL BOX|CLOUD CONNECT|SECONDO INVERTER/i.test(label)) return false
  return /ZAVORRE|OTTIMIZZATORI/i.test(label)
}

function isAccessoryStop(line: string) {
  const label = normalized(line)
  return (
    label.includes("ECCETTO") ||
    label.includes("BATTERIE DA") ||
    label.includes("POTENZE INFERIORI") ||
    label.startsWith("ZONA ") ||
    label.startsWith("EPS") ||
    label.includes("% DI SCONTO")
  )
}

function isAccessorySectionStart(line: string) {
  const label = normalized(line)
  return label === "ACCESSORI" || label === "LISTINO ACCESSORI" || label.startsWith("LISTINO ACCESSORI ")
}

function accessoryFromCells(cells: string[]): AccessorioCommerciale | null {
  const cleanCells = cells.map((cell) => cell.trim()).filter(Boolean)
  if (cleanCells.length < 2) return null
  if (normalized(cleanCells.join(" ")).includes("ACCESSORIO PREZZO")) return null

  // Nei PDF Canva capita che una riga FV e una riga accessorio condividano la
  // stessa coordinata Y: "7 | 7.890,00 € | Wall Box ... | 1.500 €".
  const values = cleanCells.map(numberIt)
  const offset = values[0] != null &&
    REQUIRED_KWP.includes(values[0] as (typeof REQUIRED_KWP)[number]) &&
    values[1] != null &&
    values[1] > 1000
    ? 2
    : 0
  const remaining = cleanCells.slice(offset)
  if (remaining.length < 2) return null

  const name = canonicalAccessoryName(remaining[0])
  if (!name || numbersInText(name).length > 0 || /^PREZZO/i.test(normalized(name))) return null
  const priceText = remaining.slice(1).join(" ")
  const prices = numbersInText(priceText).filter((value) => value > 0)
  if (prices.length === 0) return null

  return {
    nome: name,
    prezzo: prices[0],
    prezzo_combo: prices[1] ?? null,
    unita: accessoryUnit(priceText),
    scontabile: accessoryDiscountable(name),
  }
}

function extractAccessories(lines: string[]) {
  const result: AccessorioCommerciale[] = []
  let inAccessories = false
  for (const line of lines) {
    if (isAccessorySectionStart(line)) {
      inAccessories = true
      continue
    }
    if (!inAccessories) continue
    if (isAccessoryStop(line)) break
    const accessory = accessoryFromCells(line.split("|"))
    if (accessory) result.push(accessory)
  }

  const secondoInverter = lines.find((line) => /SECONDO INVERTER/i.test(normalized(line)))
  if (secondoInverter) {
    const prices = numbersInText(secondoInverter).filter((value) => value > 0)
    if (prices.length > 0) {
      result.push({
        nome: "Secondo inverter in parallelo",
        prezzo: prices[0],
        prezzo_combo: null,
        unita: "€",
        scontabile: false,
      })
    }
  }
  return result.filter((item, index, items) => items.findIndex((candidate) =>
    normalized(candidate.nome) === normalized(item.nome) &&
    candidate.prezzo === item.prezzo &&
    candidate.prezzo_combo === item.prezzo_combo &&
    candidate.unita === item.unita,
  ) === index)
}

/** Converte autonomamente un PDF commerciale nella matrice finale del CRM. */
export function parseListinoCommerciale(testo: string) {
  const photovoltaic = new Map<number, number>()
  const lines = testo.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const fullText = normalized(lines.join("\n"))
  const brandHeaders = findBrandHeaders(lines)
  const headerIndexes = [...brandHeaders.keys()]
  const exceptionLine = lines.find((line) => normalized(line).includes("ECCETTO"))
  const exceptions = new Set(
    exceptionLine
      ? normalized(exceptionLine).replace(/^.*?ECCETTO\s+/, "").split(/\s+E\s+|[,;/]/).map((item) => normalized(item)).filter(Boolean)
      : [],
  )
  const fiveKwhRule = fullText.match(/BATTERIE? DA 5 KWH.*?TOGLIERE\s+([\d.]+)\s*EURO/)
  const lowerRule = fullText.match(/POTENZE INFERIORI A\s+(\d+).*?TOGLIERE\s+([\d.]+)\s*EURO AL KWP/)
  const tenKwpRule = /10 KWP.*?AGGIUNGIAMO\s+([\d.]+)\s*EURO/.exec(fullText)
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

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const label = normalized(line.replace(/\|/g, " "))
    const dynamicBrand = brandHeaders.get(lineIndex)
    if (dynamicBrand) {
      brand = dynamicBrand
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
    if (isCapacityHeader(line)) {
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
      const headerIndex = headerIndexes.find((index) => normalized(brandHeaders.get(index) ?? "") === normalized(brand!)) ?? lineIndex
      const nextHeaderIndex = headerIndexes.find((index) => index > headerIndex)
      const metadata = extractBrandMetadata(lines, headerIndex, nextHeaderIndex)
      const addFive = fiveKwhRule && capacities[0] > 10 && !exceptions.has(normalized(brand))
      matrix = {
        marca: brand,
        ...metadata,
        taglie: addFive ? [5, ...capacities] : [...capacities],
        prezzi: {},
      }
      matrices.push(matrix)
    }
    const fiveDiscount = fiveKwhRule ? numberIt(fiveKwhRule[1]) ?? 0 : 0
    matrix.prezzi[String(kwp)] = matrix.taglie.map((capacity) => {
      const sourceIndex = capacities.findIndex((item) => Math.abs(item - capacity) < 0.001)
      if (sourceIndex >= 0) return Math.max(0, (totals[sourceIndex] as number) - base)
      return Math.max(0, (totals[0] as number) - fiveDiscount - base)
    })
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

  const lowerThreshold = lowerRule ? Number(lowerRule[1]) : null
  const lowerStep = lowerRule ? numberIt(lowerRule[2]) : null
  const tenStep = tenKwpRule ? numberIt(tenKwpRule[1]) : null
  for (const matrix of matrices) {
    const rows = explicitRows.get(normalized(matrix.marca)) ?? new Set<number>()
    const anchors = [...rows].sort((a, b) => a - b)
    if (anchors.length === 0) continue
    for (const kwp of REQUIRED_KWP) {
      if (rows.has(kwp)) continue
      const anchor = kwp < anchors[0] ? anchors[0] : anchors[anchors.length - 1]
      const anchorValues = matrix.prezzi[String(anchor)]
      matrix.prezzi[String(kwp)] = anchorValues.map((anchorPrice, capacityIndex) => {
        if (kwp < anchor && lowerThreshold != null && lowerStep != null && anchor === lowerThreshold) {
          const totalDelta = exceptions.has(normalized(matrix.marca)) ? 0 : -lowerStep * (anchor - kwp)
          return Math.max(0, Math.round((photovoltaic.get(anchor) ?? 0) + anchorPrice + totalDelta - (photovoltaic.get(kwp) ?? 0)))
        }
        if (kwp > anchor && kwp === 10 && tenStep != null) {
          // Sineng applica la maggiorazione al totale; le altre marche al
          // sovrapprezzo accumulo, come specificato dal listino di riferimento.
          if (normalized(matrix.marca) === "SINENG") {
            return Math.max(0, Math.round((photovoltaic.get(anchor) ?? 0) + anchorPrice + tenStep - (photovoltaic.get(kwp) ?? 0)))
          }
          if (normalized(matrix.marca) === "BYD" && matrix.taglie[capacityIndex] === 5) {
            return Math.max(0, anchorPrice - tenStep)
          }
          return Math.max(0, anchorPrice + tenStep)
        }
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
    accessori: extractAccessories(lines),
    sconti: extractDiscounts(lines),
    note: extractNotes(lines),
    parsedBase,
    parsedBattery,
  }
}
