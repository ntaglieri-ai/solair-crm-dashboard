"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CLIENTI_FIELD_OPTION_DEFINITIONS,
  CLIENTI_OPTION_COLUMNS,
  CLIENTI_PICKLIST_FALLBACKS,
  type ClienteOptionColumn,
} from "@/lib/clienti/picklist-options"
import {
  uniqueOptions,
  withCurrentColumnOption,
  type ColumnValueOption,
} from "@/lib/crm-settings/column-values"

type ClienteFieldOptionsResponse = {
  options: Partial<Record<ClienteOptionColumn, ColumnValueOption[]>>
}

export function useClienteFieldOptions() {
  const query = useQuery({
    queryKey: ["cliente-field-options"],
    queryFn: async ({ signal }) => {
      const fields = CLIENTI_OPTION_COLUMNS.join(",")
      const response = await fetch(`/api/clienti/field-options?fields=${fields}`, { signal })
      if (!response.ok) throw new Error("Caricamento valori Clienti non riuscito")
      return response.json() as Promise<ClienteFieldOptionsResponse>
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  function optionsFor(column: ClienteOptionColumn, current?: unknown) {
    const fallback = CLIENTI_FIELD_OPTION_DEFINITIONS.find(
      (definition) => definition.column === column,
    )?.options ?? []
    const options = uniqueOptions([
      ...(query.data?.options[column] ?? []),
      ...fallback,
    ])
    return withCurrentColumnOption(options, current)
  }

  function optionsForField(field: keyof typeof CLIENTI_PICKLIST_FALLBACKS, current?: unknown) {
    return optionsFor(CLIENTI_PICKLIST_FALLBACKS[field].column as ClienteOptionColumn, current)
  }

  return { ...query, optionsFor, optionsForField }
}
