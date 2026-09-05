"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  ColumnValueOption,
  CrmColumnValueRow,
  CrmValuesModule,
} from "@/lib/crm-settings/column-values"
import { optionsFromColumnValues } from "@/lib/crm-settings/column-values"

export const crmColumnValuesKeys = {
  all: ["crm-column-values"] as const,
  module: (module: CrmValuesModule) => [...crmColumnValuesKeys.all, module] as const,
}

export function useCrmColumnValues(module: CrmValuesModule) {
  return useQuery({
    queryKey: crmColumnValuesKeys.module(module),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ module })
      const res = await fetch(`/api/crm-settings/schema/default-values?${params}`, { signal })
      if (!res.ok) throw new Error("Caricamento valori configurati non riuscito")
      const body = (await res.json()) as { values: CrmColumnValueRow[] }
      return body.values
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useColumnValueOptions(
  module: CrmValuesModule,
  columnName: string,
  fallback: ColumnValueOption[],
  opts?: { valueSource?: "label" | "value"; includeFallback?: boolean },
) {
  const query = useCrmColumnValues(module)
  return {
    ...query,
    options: optionsFromColumnValues(query.data, columnName, fallback, opts),
  }
}
