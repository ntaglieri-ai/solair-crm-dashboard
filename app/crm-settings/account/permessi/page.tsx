import { createClient } from "@/lib/supabase/server"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import {
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  type Ruolo,
  type RuoloColore,
  type PaginaId,
  type ModuloRecordId,
  type RecordPermesso,
} from "@/lib/ruoli-data"
import { PermissionManagementClient } from "./permission-management-client"

// Tabelle Supabase normalizzate per la gestione permessi.
type RuoloRow = {
  id: string
  code: string | null
  nome: string
  descrizione: string | null
  colore: string | null
  ordinamento: number | null
}
type PaginaAccesso = "no_access" | "r" | "rw"
type PermessoPaginaRow = {
  ruolo_id: string
  pagina: string
  accesso: PaginaAccesso | boolean | null
}
type PermessoRecordRow = {
  ruolo_id: string
  modulo: string
  azione: string
  abilitato: boolean
}
type PermessoUiRow = { ruolo_id: string; chiave: string; abilitato: boolean }
type PermessoAzioneRow = { ruolo_id: string; azione: string; abilitato: boolean }
type PermessoScopeRow = { ruolo_id: string; risorsa: string; scope: string }
type PermessoCampoRow = {
  ruolo_id: string
  modulo: string
  campo: string
  accesso: string
}
type UtenteRuoloRow = { ruolo: string | null; ruolo_id: string | null }

// Coerce il colore DB su uno dei colori UI supportati (fallback: gray).
function toColore(value: string | null): RuoloColore {
  return value === "navy" || value === "teal" || value === "gray"
    ? value
    : "gray"
}

// Costruisce i Ruolo[] attesi dalla UI a partire dalle righe normalizzate.
function buildRuoli(
  ruoli: RuoloRow[],
  permessiPagina: PermessoPaginaRow[],
  permessiRecord: PermessoRecordRow[],
  permessiUi: PermessoUiRow[],
  permessiAzione: PermessoAzioneRow[],
  permessiScope: PermessoScopeRow[],
  permessiCampo: PermessoCampoRow[],
  utenti: UtenteRuoloRow[],
): Ruolo[] {
  const validPagine = new Set<string>(PAGINE.map((p) => p.id))
  const validModuli = new Set<string>(MODULI_RECORD.map((m) => m.id))
  const validAzioni = new Set<string>(RECORD_PERMESSI.map((p) => p.id))

  return ruoli.map((r) => {
    // Pagine: default tutte false, poi applica gli accessi salvati.
    const pagine = Object.fromEntries(
      PAGINE.map((p) => [p.id, false]),
    ) as Record<PaginaId, boolean>
    for (const row of permessiPagina) {
      if (row.ruolo_id === r.id && validPagine.has(row.pagina)) {
        pagine[row.pagina as PaginaId] =
          row.accesso === true || row.accesso === "r" || row.accesso === "rw"
      }
    }

    // Record: default array vuoti, poi aggiunge le azioni abilitate.
    const record = Object.fromEntries(
      MODULI_RECORD.map((m) => [m.id, [] as RecordPermesso[]]),
    ) as Record<ModuloRecordId, RecordPermesso[]>
    for (const row of permessiRecord) {
      if (
        row.ruolo_id === r.id &&
        row.abilitato &&
        validModuli.has(row.modulo) &&
        validAzioni.has(row.azione)
      ) {
        record[row.modulo as ModuloRecordId].push(row.azione as RecordPermesso)
      }
    }

    // Permessi UI: scope sedi/cartelle (true = "all") e flag riconfigurazioni.
    const ui = new Map(
      permessiUi
        .filter((row) => row.ruolo_id === r.id)
        .map((row) => [row.chiave, row.abilitato]),
    )
    const azioni = Object.fromEntries(
      permessiAzione
        .filter((row) => row.ruolo_id === r.id)
        .map((row) => [row.azione, row.abilitato]),
    )
    const scope_dati = Object.fromEntries(
      permessiScope
        .filter((row) => row.ruolo_id === r.id)
        .map((row) => [row.risorsa, row.scope]),
    )
    const campi: Record<string, Record<string, string>> = {}
    for (const row of permessiCampo) {
      if (row.ruolo_id !== r.id) continue
      campi[row.modulo] ??= {}
      campi[row.modulo][row.campo] = row.accesso
    }

    return {
      id: r.id,
      nome: r.nome,
      descrizione: r.descrizione ?? "",
      colore: toColore(r.colore),
      utenti: utenti.filter(
        (u) => u.ruolo_id === r.id || (r.code !== null && u.ruolo === r.code),
      ).length,
      permessi: {
        pagine,
        record,
        visibilita_sedi: ui.get("visibilita_sedi") ? "all" : "own",
        cartelle_nextcloud: ui.get("cartelle_nextcloud") ? "all" : "own",
        riconfigurazioni: ui.get("riconfigurazioni") === true,
        azioni,
        scope_dati,
        campi,
      },
    } satisfies Ruolo
  })
}

export default async function PermissionManagementPage() {
  const supabase = await createClient()

  const [
    currentPermissions,
    { data: ruoli },
    { data: permessiPagina },
    { data: permessiRecord },
    { data: permessiUi },
    { data: permessiAzione },
    { data: permessiScope },
    { data: permessiCampo },
    { data: utenti },
  ] =
    await Promise.all([
      loadCurrentPermissionSnapshot(),
      supabase
        .from("ruoli")
        .select("id, code, nome, descrizione, colore, ordinamento")
        .order("ordinamento", { ascending: true }),
      supabase.from("permessi_pagina").select("ruolo_id, pagina, accesso"),
      supabase.from("permessi_record").select("ruolo_id, modulo, azione, abilitato"),
      supabase.from("permessi_ui").select("ruolo_id, chiave, abilitato"),
      supabase.from("permessi_azione").select("ruolo_id, azione, abilitato"),
      supabase.from("permessi_scope").select("ruolo_id, risorsa, scope"),
      supabase.from("permessi_campo").select("ruolo_id, modulo, campo, accesso"),
      supabase.from("utenti").select("ruolo, ruolo_id"),
    ])

  const mapped = buildRuoli(
    (ruoli as RuoloRow[] | null) ?? [],
    (permessiPagina as PermessoPaginaRow[] | null) ?? [],
    (permessiRecord as PermessoRecordRow[] | null) ?? [],
    (permessiUi as PermessoUiRow[] | null) ?? [],
    (permessiAzione as PermessoAzioneRow[] | null) ?? [],
    (permessiScope as PermessoScopeRow[] | null) ?? [],
    (permessiCampo as PermessoCampoRow[] | null) ?? [],
    (utenti as UtenteRuoloRow[] | null) ?? [],
  )

  return (
    <PermissionManagementClient
      ruoli={mapped}
      currentRoleId={currentPermissions.subject.ruoloId}
    />
  )
}
