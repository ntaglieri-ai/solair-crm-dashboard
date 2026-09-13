"use client"

import { useQuery } from "@tanstack/react-query"
import {
  LEAD_FIELD_OPTION_FALLBACKS,
  LEAD_OPTION_COLUMNS,
  type LeadOptionColumn,
} from "@/lib/leads/field-options"
import {
  uniqueOptions,
  withCurrentColumnOption,
  type ColumnValueOption,
} from "@/lib/crm-settings/column-values"

type LeadFieldOptionsResponse = {
  options: Partial<Record<LeadOptionColumn, ColumnValueOption[]>>
}

export function useLeadFieldOptions() {
  const query = useQuery({
    queryKey: ["lead-field-options"],
    queryFn: async ({ signal }) => {
      const fields = LEAD_OPTION_COLUMNS.join(",")
      const response = await fetch(`/api/leads/field-options?fields=${fields}`, { signal })
      if (!response.ok) throw new Error("Caricamento valori Lead non riuscito")
      return response.json() as Promise<LeadFieldOptionsResponse>
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  function optionsFor(column: LeadOptionColumn, current?: unknown) {
    const options = uniqueOptions([
      ...(query.data?.options[column] ?? []),
      ...LEAD_FIELD_OPTION_FALLBACKS[column],
    ])
    return withCurrentColumnOption(options, current)
  }

  return { ...query, optionsFor }
}
