import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { convertiDaZoho } from "@/lib/email/modello-base"

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

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const modulo = sp.get("modulo")

  const supabase = await createClient()
  let query = supabase
    .from("crm_email_template")
    .select("id,nome,modulo,oggetto,corpo,cartella,attivo")
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
    const esito = await converti(guardia.admin!, ids)
    if (esito.errore) return NextResponse.json({ error: esito.errore }, { status: 500 })
    return NextResponse.json({ creati: esito.creati, saltati: esito.saltati })
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
      corpo,
      cartella: typeof body.cartella === "string" ? body.cartella.trim() || null : null,
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

    const corpo = convertiDaZoho(modello.corpo ?? "")

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
  if (typeof body.corpo === "string") patch.corpo = body.corpo
  if (typeof body.cartella === "string") patch.cartella = body.cartella.trim() || null
  if (typeof body.attivo === "boolean") patch.attivo = body.attivo

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
