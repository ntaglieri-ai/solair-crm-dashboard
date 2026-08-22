// Server Component: pre-carica i dati delle viste di Compiti e li passa a
// CompitiClient come initialData (nessun caricamento dopo il mount).
//
// Vengono precaricate ANCHE le due colonne della kanban, non solo la lista: la
// kanban è la vista predefinita, ma le sue query partivano dopo il mount e
// senza dati iniziali, così per ~450ms la bacheca mostrava tutte le colonne a
// zero con "Trascina qui" — cioè affermava "non hai compiti" per poi
// smentirsi. Le tre letture sono indipendenti e vanno in parallelo.
import {
  DEFAULT_COMPITI_PARAMS,
  DEFAULT_KANBAN_FILTERS,
  buildCompitiSearchParams,
  buildKanbanDoneParams,
  buildKanbanOpenParams,
} from "@/lib/compiti/api-types"
import { queryCompiti } from "@/lib/compiti/repository"
import { OPEN_TASK_STATI } from "@/lib/mock-data"
import { CompitiClient } from "./compiti-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function CompitiPage() {
  await requirePage("compiti")

  const initialParams = DEFAULT_COMPITI_PARAMS
  const kanbanOpenParams = buildKanbanOpenParams(DEFAULT_KANBAN_FILTERS, [
    ...OPEN_TASK_STATI,
  ])
  const kanbanDoneParams = buildKanbanDoneParams(DEFAULT_KANBAN_FILTERS)

  const [initialData, kanbanOpen, kanbanDone] = await Promise.all([
    queryCompiti(initialParams),
    queryCompiti(kanbanOpenParams),
    queryCompiti(kanbanDoneParams),
  ])

  return (
    <CompitiClient
      initialSp={buildCompitiSearchParams(initialParams).toString()}
      initialData={initialData}
      initialKanbanOpen={{
        sp: buildCompitiSearchParams(kanbanOpenParams).toString(),
        data: kanbanOpen,
      }}
      initialKanbanDone={{
        sp: buildCompitiSearchParams(kanbanDoneParams).toString(),
        data: kanbanDone,
      }}
    />
  )
}
