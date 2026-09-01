// Punto di partenza del preventivo: ricerca del lead e "finalizzazione" prima
// di aprire il configuratore pubblico. Il prezzo non si calcola piu' qui, quindi
// l'unica cosa che questo endpoint scrive nel CRM e' la traccia del contatto:
// un'attivita' sul lead esistente, oppure il lead nuovo + la sua attivita'.
import { NextResponse, after } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import { applyOwnerScope, canAccessOwnedRecord, resolveOwnerScope } from "@/lib/permissions/data-scope"
import { ensureFolder } from "@/lib/nextcloud/admin-webdav"
import {
  documentiObbligatoriFolderPath,
  folderPathForRecord,
} from "@/lib/allegati/paths"

const MAX_RISULTATI = 8
const CAMPI_CONTATTO = "id, nome_lead, nome, cognome, email, telefono"

export type LeadPreventivo = {
  id: string
  nome_lead: string | null
  nome: string | null
  cognome: string | null
  email: string | null
  telefono: string | null
}

/**
 * I metacaratteri del filtro `or=` di PostgREST (virgole e parentesi) spezzano
 * la lista di condizioni: vanno tolti dal termine, non passati come sono.
 */
function pattern(term: string) {
  return `%${term.replace(/[,()\\]/g, " ").trim()}%`
}

/** Nome completo con cui il configuratore e le attivita' identificano il lead. */
function nomeCompleto(nome: string, cognome: string) {
  return [nome, cognome].filter(Boolean).join(" ").trim()
}

export async function GET(request: Request) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  const term = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  // Sotto i 2 caratteri la ricerca restituirebbe mezzo database: meglio niente.
  if (term.length < 2) return NextResponse.json({ rows: [] })

  const supabase = await createClient()
  const p = pattern(term)
  const ownerScope = await resolveOwnerScope(guard.permissions.snapshot, "lead")
  const { data, error } = await applyOwnerScope(supabase
    .from("leads")
    .select(CAMPI_CONTATTO)
    .or(`nome_lead.ilike.${p},nome.ilike.${p},cognome.ilike.${p},email.ilike.${p},telefono.ilike.${p}`)
    .order("created_at", { ascending: false })
    .limit(MAX_RISULTATI), "lead_proprietario_id", ownerScope)

  if (error) {
    console.error("[offerta-commerciale/preventivo] ricerca lead:", error.message)
    return NextResponse.json({ error: "Errore ricerca lead" }, { status: 500 })
  }
  return NextResponse.json({ rows: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } })
}

type PostBody = {
  leadId?: string
  nuovo?: { nome?: string; cognome?: string; telefono?: string; email?: string }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PostBody | null
  const leadId = body?.leadId?.trim()
  const nuovo = body?.nuovo

  // Il permesso richiesto dipende da cosa si sta facendo: annotare un lead
  // esistente e' un edit, crearne uno e' un create.
  const guard = await requireApiRecord("lead", leadId ? "edit" : "create")
  if (guard.response) return guard.response
  const autore = guard.permissions.snapshot.subject
  const supabase = await createClient()

  let lead: LeadPreventivo
  let creato = false

  if (leadId) {
    if (!await canAccessOwnedRecord(guard.permissions.snapshot, "lead", "leads", "lead_proprietario_id", leadId)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
    const { data, error } = await supabase
      .from("leads")
      .select(CAMPI_CONTATTO)
      .eq("id", leadId)
      .maybeSingle()
    if (error) {
      console.error("[offerta-commerciale/preventivo] lettura lead:", error.message)
      return NextResponse.json({ error: "Errore lettura lead" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
    lead = data as LeadPreventivo
  } else {
    const nome = nuovo?.nome?.trim() ?? ""
    const cognome = nuovo?.cognome?.trim() ?? ""
    const telefono = nuovo?.telefono?.trim() ?? ""
    const email = nuovo?.email?.trim().toLowerCase() ?? ""
    if (!nome || !telefono) {
      return NextResponse.json({ error: "Nome e telefono sono obbligatori" }, { status: 400 })
    }
    const { data, error } = await supabase
      .from("leads")
      .insert({
        nome,
        cognome: cognome || null,
        nome_lead: nomeCompleto(nome, cognome),
        telefono,
        email: email || null,
        stato_lead: "Non contattato",
        origine_lead: "Inserimento manuale",
        paese: "Italia",
        // Assegnato a chi lo crea: con scope "assigned" (agente) un lead senza
        // proprietario sparirebbe dalla sua lista subito dopo la creazione.
        lead_proprietario_id: autore.userId,
        creato_da: autore.nome,
      })
      .select(CAMPI_CONTATTO)
      .single()
    if (error || !data) {
      console.error("[offerta-commerciale/preventivo] creazione lead:", error?.message)
      return NextResponse.json({ error: error?.message ?? "Creazione lead non riuscita" }, { status: 500 })
    }
    lead = data as LeadPreventivo
    creato = true

    // Stessa cartella Nextcloud degli altri percorsi di creazione lead, e per
    // gli stessi motivi: in background, mai bloccante (vedi app/api/leads).
    after(async () => {
      const nomeCartella = lead.nome_lead ?? ""
      const folder = await ensureFolder(folderPathForRecord("lead", lead.id, nomeCartella))
      if (!folder.ok) {
        console.error(`[offerta-commerciale/preventivo] cartella lead ${lead.id} fallita:`, folder.error)
        return
      }
      const docs = await ensureFolder(documentiObbligatoriFolderPath(lead.id, nomeCartella))
      if (!docs.ok) {
        console.error(`[offerta-commerciale/preventivo] sottocartella documenti lead ${lead.id} fallita:`, docs.error)
      }
    })
  }

  const testo = creato
    ? `Preventivo avviato dall'agente ${autore.nome}: lead creato dall'Offerta Commerciale e aperto nel configuratore.`
    : `Preventivo avviato dall'agente ${autore.nome} dal configuratore Solair.`
  const { error: attivitaError } = await supabase
    .from("attivita")
    .insert({
      tipo: "nota",
      testo,
      record_id: lead.id,
      record_tipo: "lead",
      utente_id: autore.userId,
    })
  // L'attivita' e' una traccia, non il risultato: se salta, il commerciale deve
  // comunque poter aprire il configuratore. Lo segnaliamo nella risposta.
  if (attivitaError) {
    console.error("[offerta-commerciale/preventivo] attivita:", attivitaError.message)
  }

  return NextResponse.json(
    {
      lead,
      creato,
      attivitaRegistrata: !attivitaError,
    },
    { status: creato ? 201 : 200 },
  )
}
