export type CrmColumnValueRow = {
  id: string
  table_name: string
  column_name: string
  value: string
  label: string
  color: string | null
  sort_order: number
}

export type ColumnValueOption = {
  value: string
  label: string
  color?: string | null
}

export type CrmValuesModule =
  | "Lead"
  | "Clienti"
  | "Compiti"
  | "Scadenze"
  | "Installatori"

export function option(value: string, label = value): ColumnValueOption {
  return { value, label }
}

export function uniqueOptions(options: ColumnValueOption[]) {
  const seen = new Set<string>()
  const out: ColumnValueOption[] = []
  for (const item of options) {
    const value = item.value.trim()
    const label = item.label.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({ ...item, value, label: label || value })
  }
  return out
}

export function withCurrentColumnOption(
  options: ColumnValueOption[],
  current: unknown,
  label?: string,
) {
  const value = typeof current === "string" ? current.trim() : ""
  if (!value || options.some((option) => option.value === value)) return options
  return [{ value, label: label ?? value }, ...options]
}

export function optionsFromColumnValues(
  rows: CrmColumnValueRow[] | undefined,
  columnName: string,
  fallback: ColumnValueOption[],
  opts: { valueSource?: "label" | "value"; includeFallback?: boolean } = {},
) {
  const valueSource = opts.valueSource ?? "label"
  const configured = (rows ?? [])
    .filter((row) => row.column_name === columnName)
    .map((row) => {
      const label = (row.label || row.value).trim()
      const value = (valueSource === "label" ? label : row.value).trim()
      return { value, label, color: row.color }
    })
  const base = configured.length > 0
    ? opts.includeFallback
      ? [...configured, ...fallback]
      : configured
    : fallback
  return uniqueOptions(base)
}
