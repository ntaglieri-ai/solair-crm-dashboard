import type { CatalogoCommerciale, MatriceAccumulo, PrezzoFotovoltaico } from "./types"

const BRANDS = ["SOLIS", "SINENG", "BYD", "SUNGROW", "SOLAX"] as const

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

/**
 * Estrae le tabelle che il PDF espone come righe/celle separate da " | ".
 * Le combinazioni del PDF sono prezzi completi: il sovrapprezzo accumulo si
 * ottiene sottraendo il prezzo FV senza accumulo della stessa taglia.
 * Le taglie non presenti nel PDF restano dalla versione precedente e sono
 * sempre sottoposte a revisione prima della pubblicazione.
 */
export function parseListinoCommerciale(
  testo: string,
  previous: Pick<CatalogoCommerciale, "fotovoltaico" | "accumuli">,
) {
  const photovoltaic = new Map(previous.fotovoltaico.map((row) => [row.kwp, row.prezzo]))
  const accumuli = structuredClone(previous.accumuli)
  const lines = testo.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  let inBaseTable = false
  let parsedBase = 0
  for (const line of lines) {
    const label = normalized(line.replace(/\|/g, " "))
    if (label.includes("SENZA ACCUMULO")) { inBaseTable = true; continue }
    if (!inBaseTable || !line.includes("|")) continue
    const values = rowNumbers(line)
    if (values[0] != null && values[0] >= 3 && values[0] <= 10 && values[1] != null && values[1] > 1000) {
      photovoltaic.set(values[0], values[1])
      parsedBase++
    }
  }
  let brand: string | null = null
  let capacities: number[] = []
  let baseMode = false
  let parsedBattery = 0

  for (const line of lines) {
    const label = normalized(line.replace(/\|/g, " "))
    const foundBrand = BRANDS.find((item) => label === item)
    if (foundBrand) {
      brand = foundBrand === "SOLAX" ? "SolaX" : foundBrand[0] + foundBrand.slice(1).toLowerCase()
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
    if (!line.includes("|")) continue
    const numbers = rowNumbers(line)
    const kwp = numbers[0]
    if (kwp == null || kwp < 3 || kwp > 10) continue

    if (baseMode) {
      const price = numbers[1]
      if (price != null && price > 1000) {
        photovoltaic.set(kwp, price)
      }
      continue
    }
    if (!brand || capacities.length === 0) continue
    const totals = numbers.slice(1, capacities.length + 1)
    if (totals.length !== capacities.length || totals.some((item) => item == null)) continue
    const base = photovoltaic.get(kwp)
    if (base == null) continue
    let matrix = accumuli.find((item) => item.marca.toLowerCase() === brand!.toLowerCase())
    if (!matrix) {
      matrix = { marca: brand, taglie: capacities, prezzi: {} }
      accumuli.push(matrix)
    }
    mergePrices(matrix, kwp, capacities, totals as number[], base)
    parsedBattery += capacities.length
  }

  return {
    fotovoltaico: [...photovoltaic.entries()].map(([kwp, prezzo]) => ({ kwp, prezzo } satisfies PrezzoFotovoltaico)).sort((a, b) => a.kwp - b.kwp),
    accumuli,
    parsedBase,
    parsedBattery,
  }
}

function mergePrices(matrix: MatriceAccumulo, kwp: number, capacities: number[], totals: number[], base: number) {
  const oldTaglie = [...matrix.taglie]
  const mergedTaglie = [...new Set([...oldTaglie, ...capacities])].sort((a, b) => a - b)
  const oldValues = new Map(oldTaglie.map((capacity, index) => [capacity, matrix.prezzi[String(kwp)]?.[index] ?? 0]))
  capacities.forEach((capacity, index) => oldValues.set(capacity, Math.max(0, totals[index] - base)))
  matrix.taglie = mergedTaglie
  for (const [rowKwp, values] of Object.entries(matrix.prezzi)) {
    const previous = new Map(oldTaglie.map((capacity, index) => [capacity, values[index] ?? 0]))
    matrix.prezzi[rowKwp] = mergedTaglie.map((capacity) => rowKwp === String(kwp) ? oldValues.get(capacity) ?? 0 : previous.get(capacity) ?? 0)
  }
  matrix.prezzi[String(kwp)] = mergedTaglie.map((capacity) => oldValues.get(capacity) ?? 0)
}
