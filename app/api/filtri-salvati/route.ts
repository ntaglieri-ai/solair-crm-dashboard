import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { validaAlbero, type CampoFiltrabile } from "@/lib/filtri/albero"
import { catalogoDaGruppi, gruppiCampiLead } from "@/lib/filtri/catalogo-lead"
import { catalogoClientiCompleto } from "@/lib/filtri/catalogo-clienti"

/**
 * Filtri salvati, condivisi fra tutti.
 *
 * Su Zoho restano personali e non si possono passare ai colleghi: chi
 * costruisce un filtro utile se lo tiene. Qui sono di tutti, ed e' la
 * ragione principale per cui li rifacciamo invece di importarli.
 *
 * La definizione viene validata contro il catalogo del modulo prima di
 * essere salvata: un filtro che arriva dal browser non entra nel database
 * senza che campi e operatori siano stati riconosciuti.
 */

const MODULI = ["lead", "clienti", "installatori", "compiti"] as const
type Modulo = (typeof MODULI)[number]

function isModulo(valore: unknown): valore is Modulo {
  return typeof valore === "string" && (MODULI as readonly string[]).includes(valore)
}

/**
 * Il catalogo del modulo, con le opzioni lasciate aperte.
 *
 * Qui interessa che campo e operatore esistano e siano compatibili; i valori
 * ammessi dei campi a elenco cambiano nel tempo (un nuovo stato, un nuovo
 * proprietario) e bloccarli al salvataggio renderebbe invalido un filtro
 * corretto il giorno dopo.
 */
function catalogoPerModulo(modulo: Modulo): CampoFiltrabile[] {
  if (modulo === "clienti") return catalogoClientiCompleto()
  if (modulo === "lead") {
    const gruppi = gruppiCampiLead({
      stati: [],
      origini: [],
      sedi: [],
      proprietari: [],
      tag: [],
    })
    // Le opzioni vengono tolte di proposito: interessa che campo e
    // operatore esistano, non che il valore sia fra quelli di oggi.
    return catalogoDaGruppi(gruppi).map((campo) => ({
      chiave: campo.chiave,
      etichetta: campo.etichetta,
      tipo: campo.tipo,
    }))
  }
  return []
}

export async function GET(request: Request) {
  const modulo = new URL(request.url).searchParams.get("modulo")
  if (!isModulo(modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }

  const permissions = await getCurrentPermissions()
  if (!permissions.canPage(modulo)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_filtri_salvati")
    .select("id,nome,definizione,creato_da,creato_il")
    .eq("modulo", modulo)
    .order("nome")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ filtri: data ?? [] })
}

export async function POST(request: Request) {
  let body: { modulo?: unknown; nome?: unknown; definizione?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo richiesta non valido" }, { status: 400 })
  }

  if (!isModulo(body.modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }

  const permissions = await getCurrentPermissions()
  if (!permissions.canPage(body.modulo)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : ""
  if (!nome || nome.length > 80) {
    return NextResponse.json({ error: "Nome non valido" }, { status: 400 })
  }

  const validato = validaAlbero(body.definizione, catalogoPerModulo(body.modulo))
  if (!validato.ok) {
    return NextResponse.json({ error: validato.errore }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_filtri_salvati")
    .insert({
      modulo: body.modulo,
      nome,
      definizione: validato.gruppo,
      creato_da: permissions.snapshot.subject.userId,
    })
    .select("id,nome,definizione,creato_da,creato_il")
    .single()

  if (error) {
    // Il nome e' unico per modulo: due filtri omonimi renderebbero l'elenco
    // illeggibile, e il messaggio del database non lo spiegherebbe.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Esiste gia' un filtro con questo nome" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Id mancante" }, { status: 400 })

  const permissions = await getCurrentPermissions()
  const supabase = await createClient()

  const { data: filtro } = await supabase
    .from("crm_filtri_salvati")
    .select("creato_da")
    .eq("id", id)
    .maybeSingle()

  if (!filtro) return NextResponse.json({ error: "Filtro non trovato" }, { status: 404 })

  // Chi l'ha creato lo elimina; gli amministratori possono togliere anche
  // quelli altrui, perche' un filtro condiviso sbagliato resterebbe li' per
  // tutti se il suo autore non c'e' piu'.
  const proprio = filtro.creato_da === permissions.snapshot.subject.userId
  if (!proprio && !permissions.canAction("note.gestione")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { error } = await supabase.from("crm_filtri_salvati").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
