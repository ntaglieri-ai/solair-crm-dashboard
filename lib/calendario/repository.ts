import { createClient } from "@/lib/supabase/server"
import {
  CALENDARIO_CATEGORIE_KEY,
  CORRELATO_COLONNA,
  parseCategorie,
  type CategoriaCalendario,
  type EventoCalendario,
  type EventoCorrelatoTipo,
} from "./types"

const EVENTO_COLUMNS =
  "id,titolo,categoria_id,colore,inizio,fine,note,cliente_id,lead_id,installatore_id,creato_da,origine,external_id,external_updated_at,external_cancelled_at,created_at,updated_at"

type EventoRow = Omit<
  EventoCalendario,
  "creato_da_nome" | "correlato_tipo" | "correlato_nome"
>

export interface EventiQuery {
  /** Estremo inferiore incluso (ISO). */
  da?: string | null
  /** Estremo superiore escluso (ISO). */
  a?: string | null
  categoria?: string | null
  /** Filtra sugli eventi collegati a un record specifico. */
  correlato?: { tipo: EventoCorrelatoTipo; id: string } | null
  /** Solo gli eventi creati da questo utente. */
  creatoDa?: string | null
}

/**
 * Nomi dei record collegati, in tre query batch invece che una per
 * evento. Le tre colonne sono alternative fra loro, quindi ogni evento
 * contribuisce al massimo a un id.
 */
async function correlatiNomi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: EventoRow[],
) {
  const clienti = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean))] as string[]
  const leads = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))] as string[]
  const installatori = [
    ...new Set(rows.map((r) => r.installatore_id).filter(Boolean)),
  ] as string[]

  const [clientiRes, leadsRes, installatoriRes] = await Promise.all([
    clienti.length
      ? supabase.from("clienti").select("id,nome_clienti").in("id", clienti)
      : Promise.resolve({ data: [] }),
    leads.length
      ? supabase.from("leads").select("id,nome_lead").in("id", leads)
      : Promise.resolve({ data: [] }),
    installatori.length
      ? supabase.from("installatori").select("id,nome").in("id", installatori)
      : Promise.resolve({ data: [] }),
  ])

  return {
    cliente: new Map(
      (clientiRes.data ?? []).map((r) => [r.id as string, r.nome_clienti as string]),
    ),
    lead: new Map((leadsRes.data ?? []).map((r) => [r.id as string, r.nome_lead as string])),
    installatore: new Map(
      (installatoriRes.data ?? []).map((r) => [r.id as string, r.nome as string]),
    ),
  }
}

type CorrelatiNomi = Awaited<ReturnType<typeof correlatiNomi>>

/**
 * Un record collegato che l'utente non puo' vedere (RLS su
 * leads/clienti) non compare nella mappa: l'evento resta, con il nome
 * sostituito da un segnaposto. Nascondere l'evento sarebbe peggio — il
 * calendario e' condiviso, e un buco inspiegabile confonde piu' di una
 * riga senza nome.
 */
function correlatoDi(row: EventoRow, nomi: CorrelatiNomi) {
  if (row.cliente_id) {
    return {
      correlato_tipo: "cliente" as const,
      correlato_nome: nomi.cliente.get(row.cliente_id) ?? "Cliente non accessibile",
    }
  }
  if (row.lead_id) {
    return {
      correlato_tipo: "lead" as const,
      correlato_nome: nomi.lead.get(row.lead_id) ?? "Lead non accessibile",
    }
  }
  if (row.installatore_id) {
    return {
      correlato_tipo: "installatore" as const,
      correlato_nome:
        nomi.installatore.get(row.installatore_id) ?? "Installatore non accessibile",
    }
  }
  return { correlato_tipo: null, correlato_nome: null }
}

async function autoriNomi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: EventoRow[],
) {
  const ids = [...new Set(rows.map((row) => row.creato_da).filter(Boolean))] as string[]
  if (ids.length === 0) return new Map<string, string>()
  const { data } = await supabase.from("utenti").select("id,nome").in("id", ids)
  return new Map((data ?? []).map((user) => [user.id as string, user.nome as string]))
}

export async function queryEventi(params: EventiQuery): Promise<EventoCalendario[]> {
  const supabase = await createClient()
  let query = supabase.from("eventi_calendario").select(EVENTO_COLUMNS)
  query = query.is("external_cancelled_at", null)

  // Il confronto e' sempre su `inizio`: un evento con `fine` oltre la
  // finestra resta incluso se comincia dentro. Va bene per le viste
  // mese/settimana, dove gli eventi non attraversano il periodo.
  if (params.da) query = query.gte("inizio", params.da)
  if (params.a) query = query.lt("inizio", params.a)
  if (params.categoria) query = query.eq("categoria_id", params.categoria)
  if (params.creatoDa) query = query.eq("creato_da", params.creatoDa)
  if (params.correlato) {
    query = query.eq(CORRELATO_COLONNA[params.correlato.tipo] as string, params.correlato.id)
  }

  const { data, error } = await query.order("inizio", { ascending: true })
  if (error) throw new Error(`Lettura eventi calendario: ${error.message}`)

  const rows = (data ?? []) as EventoRow[]
  const [autori, correlati] = await Promise.all([
    autoriNomi(supabase, rows),
    correlatiNomi(supabase, rows),
  ])
  return rows.map((row) => ({
    ...row,
    creato_da_nome: row.creato_da ? (autori.get(row.creato_da) ?? null) : null,
    ...correlatoDi(row, correlati),
  }))
}

export async function getCategorie(): Promise<CategoriaCalendario[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", CALENDARIO_CATEGORIE_KEY)
    .maybeSingle()

  // Errore o riga assente: parseCategorie ricade sul set iniziale, cosi'
  // il calendario resta usabile anche se la config sparisce.
  if (error) return parseCategorie(null)
  return parseCategorie(data?.valore)
}

export async function getEventoById(id: string): Promise<EventoCalendario | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("eventi_calendario")
    .select(EVENTO_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null

  const row = data as EventoRow
  const [autori, correlati] = await Promise.all([
    autoriNomi(supabase, [row]),
    correlatiNomi(supabase, [row]),
  ])
  return {
    ...row,
    creato_da_nome: row.creato_da ? (autori.get(row.creato_da) ?? null) : null,
    ...correlatoDi(row, correlati),
  }
}
