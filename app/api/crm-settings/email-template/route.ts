import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentPermissions } from "@/lib/permissions/server"
import {
  aziendaDaProfilo,
  convertiDaZoho,
  modelloBase,
  type AziendaEmail,
} from "@/lib/email/modello-base"

/**
 * Modelli e-mail condivisi.
 *
 * Lettura a chiunque sia autenticato: chi puo' scrivere un'email deve poter
 * scegliere un modello. Creazione, modifica ed eliminazione passano dal
 * permesso `email_template.gestione`, concesso a Superadmin e
 * Amministratori e attivabile per gli altri dalla pagina Permessi.
 *
 * La scrittura usa la chiave di servizio perche' la tabella concede solo la
 * lettura: cosi' l'unico modo di modificare un modello e' passare da qui,
 * dove il permesso viene verificato.
 */

const MODULI = ["clienti", "lead", "installatori"] as const
type Modulo = (typeof MODULI)[number]

const AZIONE = "email_template.gestione"

/** Suffisso dei modelli convertiti, per distinguerli dagli originali. */
const SUFFISSO = " (nuovo)"

function isModulo(valore: unknown): valore is Modulo {
  return typeof valore === "string" && (MODULI as readonly string[]).includes(valore)
}

async function richiediGestione() {
  const permissions = await getCurrentPermissions()
  if (!permissions.canAction(AZIONE)) {
    return { permissions, errore: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }
  const admin = createAdminClient()
  if (!admin) {
    return {
      permissions,
      errore: NextResponse.json(
        { error: "Gestione modelli non disponibile: chiave di servizio non configurata" },
        { status: 503 },
      ),
    }
  }
  return { permissions, admin, errore: null }
}

function isDocumentoEmailCompleto(corpo: string): boolean {
  return /<\s*(html|body)\b/i.test(corpo)
}

async function preparaCorpoPerSalvataggio(
  admin: NonNullable<Awaited<ReturnType<typeof richiediGestione>>["admin"]>,
  corpo: string,
): Promise<string> {
  const pulito = corpo.trim()
  if (!pulito || isDocumentoEmailCompleto(pulito)) return corpo

  return modelloBase(corpo, await caricaAzienda(admin))
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const modulo = sp.get("modulo")

  const supabase = await createClient()
  let query = supabase
    .from("crm_email_template")
    .select("id,nome,modulo,oggetto,corpo,cartella,attivo,zoho_id")
    .order("nome")

  if (isModulo(modulo)) query = query.eq("modulo", modulo)
  // I modelli spenti restano nella pagina di gestione ma non fra quelli
  // proponibili: chi scrive un'email non deve vedere roba dismessa.
  if (sp.get("soloAttivi") === "1") query = query.eq("attivo", true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data ?? [] })
}

export async function POST(request: Request) {
  const guardia = await richiediGestione()
  if (guardia.errore) return guardia.errore

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo richiesta non valido" }, { status: 400 })
  }

  // Conversione nel formato Solair: arriva dallo stesso endpoint perche'
  // richiede lo stesso permesso e scrive sulla stessa tabella.
  if (body.azione === "converti") {
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : []
    if (!ids.length) return NextResponse.json({ error: "Nessun modello indicato" }, { status: 400 })
    const azienda = await caricaAzienda(guardia.admin!)
    const esito = await converti(guardia.admin!, ids, azienda)
    if (esito.errore) return NextResponse.json({ error: esito.errore }, { status: 500 })
    return NextResponse.json({ creati: esito.creati, saltati: esito.saltati })
  }

  // Passaggio massivo dai modelli Zoho ai rispettivi "(nuovo)", e ritorno.
  // Si lavora solo sugli originali importati da Zoho: i modelli creati a mano
  // nel CRM non devono essere spenti per errore.
  if (body.azione === "usa-convertiti" || body.azione === "ripristina-originali") {
    const modulo = isModulo(body.modulo) ? body.modulo : null
    const esito = await commutaConvertiti(
      guardia.admin!,
      guardia.permissions.snapshot.subject.userId,
      body.azione === "usa-convertiti" ? "convertiti" : "originali",
      modulo,
    )
    if (esito.errore) return NextResponse.json({ error: esito.errore }, { status: 500 })
    return NextResponse.json(esito)
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : ""
  const oggetto = typeof body.oggetto === "string" ? body.oggetto.trim() : ""
  const corpo = typeof body.corpo === "string" ? body.corpo : ""

  if (!nome || nome.length > 120) {
    return NextResponse.json({ error: "Nome non valido" }, { status: 400 })
  }
  if (!oggetto) return NextResponse.json({ error: "Oggetto mancante" }, { status: 400 })
  if (!isModulo(body.modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }

  const { data, error } = await guardia.admin!
    .from("crm_email_template")
    .insert({
      nome,
      modulo: body.modulo,
      oggetto,
      corpo: await preparaCorpoPerSalvataggio(guardia.admin!, corpo),
      cartella: typeof body.cartella === "string" ? body.cartella.trim() || null : null,
      attivo: typeof body.attivo === "boolean" ? body.attivo : true,
      creato_da: guardia.permissions.snapshot.subject.userId,
    })
    .select("id,nome,modulo,oggetto,corpo,cartella,attivo")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Esiste già un modello con questo nome per il modulo" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

async function commutaConvertiti(
  admin: NonNullable<Awaited<ReturnType<typeof richiediGestione>>["admin"]>,
  userId: string | null,
  modo: "convertiti" | "originali",
  modulo: Modulo | null,
) {
  let queryOriginali = admin
    .from("crm_email_template")
    .select("id,nome,modulo")
    .not("zoho_id", "is", null)

  if (modulo) queryOriginali = queryOriginali.eq("modulo", modulo)

  const { data: originali, error: erroreOriginali } = await queryOriginali
  if (erroreOriginali) return { errore: erroreOriginali.message }
  if (!originali?.length) {
    return { errore: null, attivati: 0, nascosti: 0, mancanti: 0 }
  }

  const nomiConvertiti = originali.map((modello) => `${modello.nome}${SUFFISSO}`)
  const { data: convertiti, error: erroreConvertiti } = await admin
    .from("crm_email_template")
    .select("id,nome,modulo")
    .in("nome", nomiConvertiti)

  if (erroreConvertiti) return { errore: erroreConvertiti.message }

  const convertitiPerChiave = new Map(
    (convertiti ?? []).map((modello) => [`${modello.modulo}:${modello.nome}`, modello.id]),
  )
  const coppie = originali
    .map((originale) => {
      const convertitoId = convertitiPerChiave.get(`${originale.modulo}:${originale.nome}${SUFFISSO}`)
      return convertitoId ? { originaleId: originale.id, convertitoId } : null
    })
    .filter((coppia): coppia is { originaleId: string; convertitoId: string } => Boolean(coppia))

  if (!coppie.length) {
    return { errore: null, attivati: 0, nascosti: 0, mancanti: originali.length }
  }

  const ora = new Date().toISOString()
  const modifiche = {
    modificato_da: userId,
    modificato_il: ora,
  }
  const idsOriginali = coppie.map((coppia) => coppia.originaleId)
  const idsConvertiti = coppie.map((coppia) => coppia.convertitoId)
  const idsDaAccendere = modo === "convertiti" ? idsConvertiti : idsOriginali
  const idsDaSpegnere = modo === "convertiti" ? idsOriginali : idsConvertiti

  const { error: erroreAccensione } = await admin
    .from("crm_email_template")
    .update({ ...modifiche, attivo: true })
    .in("id", idsDaAccendere)

  if (erroreAccensione) return { errore: erroreAccensione.message }

  const { error: erroreSpegnimento } = await admin
    .from("crm_email_template")
    .update({ ...modifiche, attivo: false })
    .in("id", idsDaSpegnere)

  if (erroreSpegnimento) return { errore: erroreSpegnimento.message }

  return {
    errore: null,
    attivati: idsDaAccendere.length,
    nascosti: idsDaSpegnere.length,
    mancanti: originali.length - coppie.length,
  }
}

/**
 * Crea la versione nel formato Solair di uno o piu' modelli.
 *
 * Non tocca gli originali: crea modelli affiancati, SPENTI, da guardare e
 * accendere uno per uno. Dei modelli Zoho si tiene il testo, non
 * l'impaginazione — quella e' generata dal loro editor e non sopravvive al
 * travaso. Su un avviso di mancato incasso non serve, su un volantino
 * promozionale si', ed e' per questo che la scelta resta all'utente.
 */
async function converti(
  admin: NonNullable<Awaited<ReturnType<typeof richiediGestione>>["admin"]>,
  ids: string[],
  azienda: AziendaEmail,
) {
  const { data: originali, error } = await admin
    .from("crm_email_template")
    .select("id,nome,modulo,oggetto,corpo,cartella")
    .in("id", ids)

  if (error) return { errore: error.message, creati: 0, saltati: 0 }

  let creati = 0
  let saltati = 0

  for (const modello of originali ?? []) {
    // Rilanciare la conversione non deve produrre "(nuovo) (nuovo)".
    if (modello.nome.endsWith(SUFFISSO)) {
      saltati += 1
      continue
    }

    const corpo = convertiDaZoho(modello.corpo ?? "", azienda)

    // Un modello il cui testo si riduce a nulla non e' convertibile: il
    // contenuto stava tutto nelle immagini. Meglio saltarlo che crearne uno
    // vuoto.
    if (corpo.replace(/<[^>]+>/g, "").trim().length < 200) {
      saltati += 1
      continue
    }

    const { error: erroreScrittura } = await admin.from("crm_email_template").upsert(
      {
        nome: `${modello.nome}${SUFFISSO}`,
        modulo: modello.modulo,
        oggetto: modello.oggetto,
        corpo,
        cartella: modello.cartella,
        attivo: false,
      },
      { onConflict: "modulo,nome" },
    )

    if (erroreScrittura) {
      saltati += 1
      continue
    }
    creati += 1
  }

  return { errore: null, creati, saltati }
}

async function caricaAzienda(
  admin: NonNullable<Awaited<ReturnType<typeof richiediGestione>>["admin"]>,
): Promise<AziendaEmail> {
  const { data } = await admin
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "company.profile")
    .maybeSingle()

  return aziendaDaProfilo(data?.valore)
}

export async function PATCH(request: Request) {
  const guardia = await richiediGestione()
  if (guardia.errore) return guardia.errore

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo richiesta non valido" }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id : ""
  if (!id) return NextResponse.json({ error: "Id mancante" }, { status: 400 })

  const patch: Record<string, unknown> = {
    modificato_da: guardia.permissions.snapshot.subject.userId,
    modificato_il: new Date().toISOString(),
  }

  if (typeof body.nome === "string") {
    const nome = body.nome.trim()
    if (!nome) return NextResponse.json({ error: "Nome non valido" }, { status: 400 })
    patch.nome = nome
  }
  if (typeof body.oggetto === "string") {
    const oggetto = body.oggetto.trim()
    if (!oggetto) return NextResponse.json({ error: "Oggetto mancante" }, { status: 400 })
    patch.oggetto = oggetto
  }
  if (typeof body.corpo === "string") {
    patch.corpo = await preparaCorpoPerSalvataggio(guardia.admin!, body.corpo)
  }
  if (typeof body.cartella === "string") patch.cartella = body.cartella.trim() || null
  if (typeof body.attivo === "boolean") patch.attivo = body.attivo
  if (isModulo(body.modulo)) patch.modulo = body.modulo

  const { data, error } = await guardia.admin!
    .from("crm_email_template")
    .update(patch)
    .eq("id", id)
    .select("id,nome,modulo,oggetto,corpo,cartella,attivo")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Esiste già un modello con questo nome per il modulo" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const guardia = await richiediGestione()
  if (guardia.errore) return guardia.errore

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Id mancante" }, { status: 400 })

  const { error } = await guardia.admin!.from("crm_email_template").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
