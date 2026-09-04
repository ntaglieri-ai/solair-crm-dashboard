export const EMPTY_FILTER_VALUE = "__empty__"

export function activeFilterValues(
  values: readonly string[] | string | null | undefined,
): string[] {
  const raw = Array.isArray(values) ? values : values ? [values] : []
  return [...new Set(raw.map((value) => value.trim()).filter((value) => value && value !== "all"))]
}

export function hasFilterValues(values: readonly string[] | string | null | undefined): boolean {
  return activeFilterValues(values).length > 0
}

export function appendFilterValues(
  params: URLSearchParams,
  key: string,
  values: readonly string[] | string | null | undefined,
) {
  for (const value of activeFilterValues(values)) params.append(key, value)
}

export function parseFilterValues(params: URLSearchParams, key: string): string[] {
  const values = params.getAll(key)
  const parts =
    values.length === 1
      ? values[0].split(",")
      : values
  return activeFilterValues(parts)
}

export function postgrestInList(values: readonly string[]): string {
  return values
    .map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",")
}
