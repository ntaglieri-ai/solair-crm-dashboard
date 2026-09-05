type WidthValue = unknown

export type ColumnWidthOptions = {
  label: string
  values: Iterable<WidthValue>
  min: number
  max?: number
  padding?: number
  charWidth?: number
}

const DEFAULT_MAX_WIDTH = 560
const DEFAULT_PADDING = 42
const DEFAULT_CHAR_WIDTH = 7.4

function textFromValue(value: WidthValue): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Sì" : "No"
  if (typeof value === "number") return value.toLocaleString("it-IT")
  if (Array.isArray(value)) return value.map(textFromValue).join(", ")
  if (value instanceof Date) return value.toLocaleString("it-IT")
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["nome", "name", "label", "title", "value"]) {
      if (typeof record[key] === "string" && record[key]) return record[key]
    }
    return Object.values(record).map(textFromValue).filter(Boolean).join(" ")
  }
  return String(value)
}

function estimatedTextWidth(text: string, charWidth: number) {
  const trimmed = text.trim()
  if (!trimmed) return 0

  let width = 0
  for (const char of trimmed) {
    if (char === " ") width += charWidth * 0.45
    else if (/[il.,'`|:;]/.test(char)) width += charWidth * 0.45
    else if (/[mwMW@#%&]/.test(char)) width += charWidth * 1.35
    else if (/[A-ZÀ-Ü0-9]/.test(char)) width += charWidth * 1.08
    else width += charWidth
  }
  return width
}

export function estimateColumnWidth({
  label,
  values,
  min,
  max = DEFAULT_MAX_WIDTH,
  padding = DEFAULT_PADDING,
  charWidth = DEFAULT_CHAR_WIDTH,
}: ColumnWidthOptions) {
  let widest = estimatedTextWidth(label, charWidth)
  for (const value of values) {
    widest = Math.max(widest, estimatedTextWidth(textFromValue(value), charWidth))
  }
  return Math.round(Math.min(max, Math.max(min, widest + padding)))
}

