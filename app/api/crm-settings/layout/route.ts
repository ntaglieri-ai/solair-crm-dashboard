import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiPage } from "@/lib/permissions/server"
import { loadLayout } from "@/lib/crm-settings/layout-server"
import { campiDuplicati } from "@/lib/crm-settings/layout"
import {
  chiaveDaEtichetta,
  formulaAutoReferenziale,
  intInRange,
  isChiaveValida,
  isEtichettaValida,
  isLayoutModulo,
  normalizzaFormato,
  validaFormula,
} from "@/lib/crm-settings/layout-validate"

/**
 * Configurazione del layout delle schede record.
 *
 * Sola lettura per chiunque possa aprire la pagina; scrittura riservata a chi
 * ha accesso rw — in pratica ADMIN e SUPERADMIN, gli unici a cui la pagina e'
 * concessa in lib/permissions/constants.ts.
 *
 * Il client manda proposte, non fatti: chiavi, etichette, riferimenti e
 * formule vengono ricontrollati qui (lib/crm-settings/layout-validate.ts)
 * prima di toccare il database.
 */

const PAGE_KEY = "crm_settings.system.layout"

function erroreSchema(error: { message?: string; code?: string }) {
  const message = error.message ?? "Operazione layout non riuscita"
  if (
    error.code === "42P01" ||
    message.toLowerCase().includes("does not exist") ||
    message.toLowerCase().includes("schema cache")
  ) {
    return "Tabelle layout non presenti su Supabase. Applica supabase/migrations/20260909_crm_layout_config.sql."
  }
  return message
}

/** Scrittura consentita solo con accesso rw sulla pagina. */
async function guardScrittura() {
  const guard = await requireApiPage(PAGE_KEY)
  if (guard.response) return guard.response
  if (guard.permissions.pageAccess(PAGE_KEY) !== "rw") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const modulo = searchParams.get("modulo") ?? ""
  if (!isLayoutModulo(modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }

  const guard = await requireApiPage(PAGE_KEY)
  if (guard.response) return guard.response

  const supabase = await createClient()
  const pagine = await loadLayout(supabase, modulo)
  return NextResponse.json({ pagine })
}

type CorpoPost = {
  modulo?: unknown
  tipo?: unknown
  // pagina
  label?: unknown
  icona?: unknown
  componente?: unknown
  // blocco
  paginaId?: unknown
  colonne?: unknown
  mostraTitolo?: unknown
  // campo
  bloccoId?: unknown
  origine?: unknown
  fieldKey?: unknown
  span?: unknown
  formato?: unknown
  formula?: unknown
}

/**
 * Crea una pagina, un blocco o un campo, a seconda di `tipo`.
 *
 * Un endpoint solo invece di tre: le tre entita' condividono modulo, guard,
 * gestione errori e calcolo dell'ordinamento, e tenerle separate
 * significherebbe ripetere tutto tre volte.
 */
export async function POST(request: Request) {
  const forbidden = await guardScrittura()
  if (forbidden) return forbidden

  let body: CorpoPost
  try {
    body = (await request.json()) as CorpoPost
  } catch {
    return NextResponse.json({ error: "Corpo richiesta non valido" }, { status: 400 })
  }

  const { modulo, tipo, label } = body
  if (!isLayoutModulo(modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }

  const supabase = await createClient()

  if (tipo === "pagina") {
    if (!isEtichettaValida(label)) {
      return NextResponse.json({ error: "Etichetta non valida" }, { status: 400 })
    }
    const pageKey = chiaveDaEtichetta(label)
    if (!isChiaveValida(pageKey)) {
      return NextResponse.json({ error: "Etichetta senza caratteri utilizzabili" }, { status: 400 })
    }

    // In coda alle esistenti: una pagina nuova non deve scavalcare quelle
    // gia' sistemate dall'admin.
    const { data: ultima } = await supabase
      .from("crm_layout_pagine")
      .select("ordinamento")
      .eq("modulo", modulo)
      .order("ordinamento", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from("crm_layout_pagine")
      .insert({
        modulo,
        page_key: pageKey,
        label: (label as string).trim(),
        icona: typeof body.icona === "string" ? body.icona.slice(0, 60) : null,
        componente: typeof body.componente === "string" ? body.componente.slice(0, 60) : null,
        ordinamento: ((ultima as { ordinamento: number } | null)?.ordinamento ?? -1) + 1,
      })
      .select("id")
      .single()

    if (error) {
      // Chiave gia' presente: l'admin ha creato due pagine con lo stesso nome.
      if (error.code === "23505") {
        return NextResponse.json({ error: "Esiste gia' una pagina con questo nome" }, { status: 409 })
      }
      return NextResponse.json({ error: erroreSchema(error) }, { status: 500 })
    }
    return NextResponse.json({ id: (data as { id: string }).id, pageKey })
  }

  if (tipo === "blocco") {
    if (typeof body.paginaId !== "string" || !body.paginaId) {
      return NextResponse.json({ error: "Pagina non indicata" }, { status: 400 })
    }
    if (!isEtichettaValida(label)) {
      return NextResponse.json({ error: "Etichetta non valida" }, { status: 400 })
    }
    const blockKey = chiaveDaEtichetta(label)
    if (!isChiaveValida(blockKey)) {
      return NextResponse.json({ error: "Etichetta senza caratteri utilizzabili" }, { status: 400 })
    }

    // La pagina deve appartenere al modulo dichiarato: senza questo controllo
    // si potrebbe agganciare un blocco alla pagina di un altro modulo
    // passandone l'id.
    const { data: pagina } = await supabase
      .from("crm_layout_pagine")
      .select("id")
      .eq("id", body.paginaId)
      .eq("modulo", modulo)
      .maybeSingle()

    if (!pagina) {
      return NextResponse.json({ error: "Pagina inesistente" }, { status: 404 })
    }

    const { data: ultimo } = await supabase
      .from("crm_layout_blocchi")
      .select("ordinamento")
      .eq("pagina_id", body.paginaId)
      .order("ordinamento", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from("crm_layout_blocchi")
      .insert({
        pagina_id: body.paginaId,
        block_key: blockKey,
        label: (label as string).trim(),
        mostra_titolo: body.mostraTitolo !== false,
        colonne: intInRange(body.colonne, 1, 4) ?? 2,
        ordinamento: ((ultimo as { ordinamento: number } | null)?.ordinamento ?? -1) + 1,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Esiste gia' un blocco con questo nome" }, { status: 409 })
      }
      return NextResponse.json({ error: erroreSchema(error) }, { status: 500 })
    }
    return NextResponse.json({ id: (data as { id: string }).id, blockKey })
  }

  if (tipo === "campo") {
    if (typeof body.bloccoId !== "string" || !body.bloccoId) {
      return NextResponse.json({ error: "Blocco non indicato" }, { status: 400 })
    }
    const origine = body.origine === "custom" ? "custom" : "system"
    if (typeof body.fieldKey !== "string" || !body.fieldKey.trim()) {
      return NextResponse.json({ error: "Campo non indicato" }, { status: 400 })
    }
    const fieldKey = body.fieldKey.trim()

    // Il blocco deve stare in una pagina di questo modulo, come sopra.
    const { data: blocco } = await supabase
      .from("crm_layout_blocchi")
      .select("id, crm_layout_pagine!inner(modulo)")
      .eq("id", body.bloccoId)
      .eq("crm_layout_pagine.modulo", modulo)
      .maybeSingle()

    if (!blocco) {
      return NextResponse.json({ error: "Blocco inesistente" }, { status: 404 })
    }

    let formula = null
    let avviso: string | null = null
    if (body.formula !== undefined && body.formula !== null) {
      const esito = validaFormula(body.formula)
      if (!esito.ok) {
        return NextResponse.json({ error: esito.errore }, { status: 400 })
      }
      formula = esito.formula
      // Una formula che dipende da se stessa non sara' calcolabile, ma il
      // salvataggio non viene bloccato: se e' cosi' che arriva da Zoho, va
      // importata comunque e sistemata dopo con il dato sotto gli occhi.
      if (formulaAutoReferenziale(fieldKey, esito.riferimenti)) {
        avviso = "La formula si riferisce al campo stesso: non sara' calcolabile."
      }
    }

    // Lo stesso campo in due blocchi mostrerebbe il dato due volte: il
    // vincolo attraversa blocco -> pagina, quindi non e' un unique di
    // tabella e va verificato qui.
    const esistente = await loadLayout(supabase, modulo)
    const gia = esistente.some((pagina) =>
      pagina.blocchi.some((b) =>
        b.campi.some((c) => c.origine === origine && c.fieldKey === fieldKey),
      ),
    )
    if (gia) {
      return NextResponse.json(
        { error: "Questo campo e' gia' presente in un altro blocco" },
        { status: 409 },
      )
    }

    const { data: ultimo } = await supabase
      .from("crm_layout_campi")
      .select("ordinamento")
      .eq("blocco_id", body.bloccoId)
      .order("ordinamento", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from("crm_layout_campi")
      .insert({
        blocco_id: body.bloccoId,
        origine,
        field_key: fieldKey,
        label_override: isEtichettaValida(label) ? (label as string).trim() : null,
        span: intInRange(body.span, 1, 4) ?? 1,
        formato: normalizzaFormato(body.formato),
        formula,
        ordinamento: ((ultimo as { ordinamento: number } | null)?.ordinamento ?? -1) + 1,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Campo gia' presente nel blocco" }, { status: 409 })
      }
      return NextResponse.json({ error: erroreSchema(error) }, { status: 500 })
    }
    return NextResponse.json({ id: (data as { id: string }).id, ...(avviso ? { avviso } : {}) })
  }

  return NextResponse.json({ error: "Tipo non riconosciuto" }, { status: 400 })
}

type CorpoPatch = {
  modulo?: unknown
  tipo?: unknown
  id?: unknown
  label?: unknown
  visible?: unknown
  colonne?: unknown
  mostraTitolo?: unknown
  span?: unknown
  solaLettura?: unknown
  formato?: unknown
  formula?: unknown
  /** Elenco ordinato di id: riordina fratelli dello stesso genitore. */
  ordine?: unknown
}

const TABELLE = {
  pagina: "crm_layout_pagine",
  blocco: "crm_layout_blocchi",
  campo: "crm_layout_campi",
} as const

export async function PATCH(request: Request) {
  const forbidden = await guardScrittura()
  if (forbidden) return forbidden

  let body: CorpoPatch
  try {
    body = (await request.json()) as CorpoPatch
  } catch {
    return NextResponse.json({ error: "Corpo richiesta non valido" }, { status: 400 })
  }

  if (!isLayoutModulo(body.modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }
  const tipo = body.tipo
  if (tipo !== "pagina" && tipo !== "blocco" && tipo !== "campo") {
    return NextResponse.json({ error: "Tipo non riconosciuto" }, { status: 400 })
  }

  const supabase = await createClient()
  const tabella = TABELLE[tipo]
  let avvisoFormula: string | null = null

  // Riordino: un elenco di id nell'ordine voluto diventa l'ordinamento.
  if (Array.isArray(body.ordine)) {
    const ids = body.ordine.filter((value): value is string => typeof value === "string")
    if (!ids.length) {
      return NextResponse.json({ error: "Ordine vuoto" }, { status: 400 })
    }
    for (const [indice, id] of ids.entries()) {
      const { error } = await supabase
        .from(tabella)
        .update({ ordinamento: indice, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) {
        return NextResponse.json({ error: erroreSchema(error) }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Elemento non indicato" }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.label !== undefined) {
    if (!isEtichettaValida(body.label)) {
      return NextResponse.json({ error: "Etichetta non valida" }, { status: 400 })
    }
    // Sul campo si rinomina solo la visualizzazione: la chiave resta quella
    // del dato sottostante, che non si muove.
    if (tipo === "campo") patch.label_override = (body.label as string).trim()
    else patch.label = (body.label as string).trim()
  }

  if (typeof body.visible === "boolean") patch.visible = body.visible

  if (tipo === "blocco") {
    const colonne = intInRange(body.colonne, 1, 4)
    if (colonne !== null) patch.colonne = colonne
    if (typeof body.mostraTitolo === "boolean") patch.mostra_titolo = body.mostraTitolo
  }

  if (tipo === "campo") {
    const span = intInRange(body.span, 1, 4)
    if (span !== null) patch.span = span
    if (typeof body.solaLettura === "boolean") patch.sola_lettura = body.solaLettura
    if (body.formato !== undefined) patch.formato = normalizzaFormato(body.formato)

    if (body.formula !== undefined) {
      if (body.formula === null) {
        patch.formula = null
      } else {
        const esito = validaFormula(body.formula)
        if (!esito.ok) {
          return NextResponse.json({ error: esito.errore }, { status: 400 })
        }
        const { data: corrente } = await supabase
          .from("crm_layout_campi")
          .select("field_key")
          .eq("id", body.id)
          .maybeSingle()
        const fieldKey = (corrente as { field_key: string } | null)?.field_key ?? ""
        if (fieldKey && formulaAutoReferenziale(fieldKey, esito.riferimenti)) {
          avvisoFormula = "La formula si riferisce al campo stesso: non sara' calcolabile."
        }
        patch.formula = esito.formula
      }
    }
  }

  const { error } = await supabase.from(tabella).update(patch).eq("id", body.id)
  if (error) {
    return NextResponse.json({ error: erroreSchema(error) }, { status: 500 })
  }

  // Rete di sicurezza: se una modifica avesse comunque prodotto un campo
  // duplicato, l'admin lo sa subito invece di scoprirlo in scheda.
  const duplicati = campiDuplicati(await loadLayout(supabase, body.modulo))
  return NextResponse.json({
    ok: true,
    ...(duplicati.length ? { duplicati } : {}),
    ...(avvisoFormula ? { avviso: avvisoFormula } : {}),
  })
}

export async function DELETE(request: Request) {
  const forbidden = await guardScrittura()
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get("tipo")
  const id = searchParams.get("id") ?? ""

  if (tipo !== "pagina" && tipo !== "blocco" && tipo !== "campo") {
    return NextResponse.json({ error: "Tipo non riconosciuto" }, { status: 400 })
  }
  if (!id) {
    return NextResponse.json({ error: "Elemento non indicato" }, { status: 400 })
  }

  const supabase = await createClient()

  // Le FK sono on delete cascade: eliminando una pagina spariscono i suoi
  // blocchi e i loro campi. E' voluto — un blocco senza pagina non avrebbe
  // dove comparire — ma vale la pena che l'interfaccia lo dica prima.
  const { error } = await supabase.from(TABELLE[tipo]).delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: erroreSchema(error) }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
