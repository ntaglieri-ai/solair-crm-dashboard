// Risoluzione dei destinatari di un invio di massa a partire dagli id
// selezionati in tabella, per i tre moduli che lo supportano.
//
// Vive qui e non nelle route perche' e' usata due volte con la STESSA
// semantica: da /api/email-massa/preview (per mostrare in anteprima quanti
// record vengono esclusi e con che dati) e da /api/email-massa (per accodare
// l'invio vero). Duplicarla vorrebbe dire poter mostrare un'anteprima che non
// corrisponde a cio' che viene realmente inviato.

import { createClient } from "@/lib/supabase/server"
import type { PermissionSnapshot } from "@/lib/permissions/types"
import type { BulkRecipient } from "./bulk-mailer"
import type { BulkPlaceholder } from "./bulk-template"

export const BULK_RECORD_TIPI = ["lead", "cliente", "installatore"] as const

export type BulkRecordTipo = (typeof BULK_RECORD_TIPI)[number]

export function isBulkRecordTipo(value: unknown): value is BulkRecordTipo {
  return (
    typeof value === "string" && (BULK_RECORD_TIPI as readonly string[]).includes(value)
  )
}

type TargetConfig = {
  /** Modulo su cui verificare il permesso record ("view"). */
  permissionModule: string
  table: string
  columns: string
  /** Colonna proprietario, per il filtro sugli utenti con ruolo AGENT. */
  ownerColumn: string
  label: { singolare: string; plurale: string }
  toRecipient: (row: Record<string, unknown>) => {
    email: string
    placeholders: Record<BulkPlaceholder, string>
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const TARGETS: Record<BulkRecordTipo, TargetConfig> = {
  lead: {
    permissionModule: "lead",
    table: "leads",
    columns: "id,nome_lead,nome,cognome,email,telefono,mobile_fisso,lead_proprietario_id",
    ownerColumn: "lead_proprietario_id",
    label: { singolare: "lead", plurale: "lead" },
    toRecipient: (row) => ({
      email: text(row.email),
      placeholders: {
        // nome_lead e' il fallback: su molti lead importati da Zoho e' l'unico
        // campo nome valorizzato.
        nome: text(row.nome) || text(row.nome_lead),
        cognome: text(row.cognome),
        email: text(row.email),
        telefono: text(row.telefono) || text(row.mobile_fisso),
      },
    }),
  },
  cliente: {
    permissionModule: "clienti",
    table: "clienti",
    columns: "id,nome_clienti,nome,cognome,email,cellulare,clienti_proprietario_id",
    ownerColumn: "clienti_proprietario_id",
    label: { singolare: "cliente", plurale: "clienti" },
    toRecipient: (row) => ({
      email: text(row.email),
      placeholders: {
        nome: text(row.nome) || text(row.nome_clienti),
        cognome: text(row.cognome),
        email: text(row.email),
        // Su Clienti il telefono e' la colonna `cellulare` (non esiste
        // `telefono`): il placeholder resta {telefono} per uniformita' UI.
        telefono: text(row.cellulare),
      },
    }),
  },
  installatore: {
    permissionModule: "installatori",
    table: "installatori",
    columns: "id,nome,email,email_secondaria,telefono,proprietario_id",
    ownerColumn: "proprietario_id",
    label: { singolare: "installatore", plurale: "installatori" },
    toRecipient: (row) => ({
      // Gli installatori hanno spesso solo la secondaria valorizzata.
      email: text(row.email) || text(row.email_secondaria),
      placeholders: {
        // Ragione sociale in un unico campo: nessun cognome separato.
        nome: text(row.nome),
        cognome: "",
        email: text(row.email) || text(row.email_secondaria),
        telefono: text(row.telefono),
      },
    }),
  },
}

export function bulkTargetConfig(tipo: BulkRecordTipo) {
  return TARGETS[tipo]
}

export type ResolvedRecipients = {
  recipients: BulkRecipient[]
  /** Selezionati dall'utente (dopo il dedup degli id). */
  totaleRichiesti: number
  /** Esclusi perche' l'agente non ne e' proprietario. */
  esclusiNonProprietari: number
  /** Esclusi perche' senza indirizzo email utilizzabile, o non piu' leggibili. */
  esclusiSenzaEmail: number
}

/**
 * Applica, nell'ordine: filtro di proprieta' (solo per ruolo AGENT) ed
 * esclusione dei record senza email. Non applica il tetto di
 * MAX_BULK_RECIPIENTS: quello e' un errore di validazione, non un
 * troncamento silenzioso, e va gestito dal chiamante.
 */
export async function resolveBulkRecipients(params: {
  tipo: BulkRecordTipo
  recordIds: string[]
  snapshot: PermissionSnapshot
}): Promise<{ data: ResolvedRecipients | null; error: string | null }> {
  const config = TARGETS[params.tipo]
  const recordIds = [...new Set(params.recordIds)]

  if (recordIds.length === 0) {
    return {
      data: {
        recipients: [],
        totaleRichiesti: 0,
        esclusiNonProprietari: 0,
        esclusiSenzaEmail: 0,
      },
      error: null,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(config.table)
    .select(config.columns)
    .in("id", recordIds)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []) as unknown as Record<string, unknown>[]

  // Solo il ruolo AGENT e' ristretto ai propri record. DIRECTOR / ADMIN /
  // SUPERADMIN inviano a tutta la selezione (decisione 28/07).
  const subject = params.snapshot.subject
  const soloPropri = subject.ruoloCode === "AGENT"
  const owned = soloPropri
    ? rows.filter((row) => text(row[config.ownerColumn]) === (subject.userId ?? ""))
    : rows

  const recipients: BulkRecipient[] = []
  for (const row of owned) {
    const mapped = config.toRecipient(row)
    if (!mapped.email.includes("@")) continue
    recipients.push({
      id: String(row.id),
      email: mapped.email,
      placeholders: mapped.placeholders,
    })
  }

  const esclusiNonProprietari = rows.length - owned.length

  return {
    data: {
      recipients,
      totaleRichiesti: recordIds.length,
      esclusiNonProprietari,
      // Include anche gli id che non tornano dalla query (record cancellato
      // nel frattempo, o non leggibile per RLS): comunque non inviabili, e
      // attribuirli alla proprieta' sarebbe fuorviante per un Director.
      esclusiSenzaEmail:
        recordIds.length - esclusiNonProprietari - recipients.length,
    },
    error: null,
  }
}
