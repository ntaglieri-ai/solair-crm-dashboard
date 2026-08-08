import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadClienteReferenceData } from "@/lib/clienti/reference-data"
import { requireApiAction, requireApiPage } from "@/lib/permissions/server"
import { isTagEmettereFattura, triggerEmettiFattura } from "@/lib/automazioni/handoff"

type TagAction =
  | { action: "toggle"; clienteId: string; tagId: string; enabled: boolean }
  | { action: "create"; names: string[]; color: string }
  | { action: "create_assign"; clienteId: string; name: string; color: string }
  | { action: "update"; tagId: string; name?: string; color?: string }
  | { action: "delete"; tagId: string }

/**
 * Esito dell'automazione 4.4 riportato al client. `null` = niente da dire
 * (tag non pertinente, oppure Compito creato/gia' presente senza problemi).
 */
type EsitoAutomazione = { avviso: string } | { info: string } | null

/**
 * Fase 4.4 — se il tag appena applicato e' "Emettere fattura", crea il Compito
 * per il responsabile fatturazione.
 *
 * Non blocca mai il tag: quando questa funzione parte l'assegnazione e' gia'
 * scritta, quindi qualsiasi problema qui diventa un avviso, mai un errore che
 * farebbe credere all'utente che il tag non sia stato applicato.
 */
async function automazioneTagFattura(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string,
  nomeTag: string,
): Promise<EsitoAutomazione> {
  if (!isTagEmettereFattura(nomeTag)) return null

  const { data: cliente, error } = await supabase
    .from("clienti")
    .select("nome_clienti")
    .eq("id", clienteId)
    .maybeSingle()
  if (error) {
    console.error(`[automazioni] lettura cliente ${clienteId} fallita:`, error.message)
    return { avviso: "Tag applicato. Compito di fatturazione non creato: cliente non leggibile." }
  }

  const esito = await triggerEmettiFattura(
    clienteId,
    (cliente?.nome_clienti as string) || "Cliente",
  )
  if (esito.ok) {
    return esito.creato ? { info: `Compito di fatturazione assegnato a ${esito.responsabile}.` } : null
  }
  return {
    avviso:
      esito.motivo === "non_configurato"
        ? "Tag applicato. Nessun Compito creato: responsabile fatturazione non configurato in Impostazioni > Comunicazioni > Automazioni handoff."
        : "Tag applicato, ma la creazione del Compito di fatturazione è fallita. Riprova o controlla i log.",
  }
}

export async function GET() {
  const guard = await requireApiPage("clienti")
  if (guard.response) return guard.response

  try {
    return NextResponse.json(await loadClienteReferenceData())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Caricamento riferimenti non riuscito" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const guard = await requireApiAction("clienti.tags.edit")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as TagAction | null
  if (!body?.action) {
    return NextResponse.json({ error: "Azione tag non valida" }, { status: 400 })
  }

  const supabase = await createClient()

  if (body.action === "create") {
    if (!Array.isArray(body.names)) {
      return NextResponse.json({ error: "Elenco tag non valido" }, { status: 400 })
    }
    const names = [...new Set(body.names.map((name) => name.trim()).filter(Boolean))]
    if (!names.length) {
      return NextResponse.json({ error: "Inserisci almeno un tag" }, { status: 400 })
    }
    const { data: existing, error: lookupError } = await supabase
      .from("tag")
      .select("id,nome,colore,created_at")
      .eq("modulo", "cliente")
      .in("nome", names)
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }
    const existingNames = new Set((existing ?? []).map((tag) => tag.nome.toLocaleLowerCase("it")))
    const rows = names
      .filter((name) => !existingNames.has(name.toLocaleLowerCase("it")))
      .map((nome) => ({ nome, colore: body.color || "#64748b", modulo: "cliente" }))
    const created = rows.length
      ? await supabase.from("tag").insert(rows).select("id,nome,colore,created_at")
      : { data: [], error: null }
    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 500 })
    }
    return NextResponse.json({
      tags: [...(existing ?? []), ...(created.data ?? [])].map((tag) => ({
        id: tag.id,
        name: tag.nome,
        color: tag.colore,
        createdAt: tag.created_at,
      })),
    })
  }

  if (body.action === "toggle") {
    if (!body.clienteId || !body.tagId) {
      return NextResponse.json({ error: "Cliente o tag non valido" }, { status: 400 })
    }
    const query = supabase
      .from("cliente_tags")
      .delete()
      .eq("cliente_id", body.clienteId)
      .eq("tag_id", body.tagId)
    const { error } = body.enabled
      ? await supabase
          .from("cliente_tags")
          .upsert(
            { cliente_id: body.clienteId, tag_id: body.tagId },
            { onConflict: "cliente_id,tag_id" },
          )
      : await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Automazione 4.4 solo in applicazione: togliere il tag non deve creare
    // nessun Compito. Il nome del tag si legge ora perche' il client manda
    // solo l'id.
    let automazione: EsitoAutomazione = null
    if (body.enabled) {
      const { data: tag, error: tagError } = await supabase
        .from("tag")
        .select("nome")
        .eq("id", body.tagId)
        .maybeSingle()
      if (tagError) {
        console.error(`[automazioni] lettura tag ${body.tagId} fallita:`, tagError.message)
      } else {
        automazione = await automazioneTagFattura(
          supabase,
          body.clienteId,
          (tag?.nome as string) ?? "",
        )
      }
    }
    return NextResponse.json({ ok: true, automazione })
  }

  if (body.action === "create_assign") {
    const name = body.name?.trim()
    if (!name || !body.clienteId) {
      return NextResponse.json({ error: "Nome tag o cliente non valido" }, { status: 400 })
    }
    const lookup = await supabase
      .from("tag")
      .select("id,nome,colore,created_at")
      .eq("modulo", "cliente")
      .ilike("nome", name)
      .maybeSingle()
    if (lookup.error) {
      return NextResponse.json({ error: lookup.error.message }, { status: 500 })
    }
    let tag = lookup.data

    if (!tag) {
      const created = await supabase
        .from("tag")
        .insert({ nome: name, colore: body.color || "#64748b", modulo: "cliente" })
        .select("id,nome,colore,created_at")
        .single()
      if (created.error) {
        return NextResponse.json({ error: created.error.message }, { status: 500 })
      }
      tag = created.data
    }

    const assigned = await supabase
      .from("cliente_tags")
      .upsert({ cliente_id: body.clienteId, tag_id: tag.id }, { onConflict: "cliente_id,tag_id" })
    if (assigned.error) {
      return NextResponse.json({ error: assigned.error.message }, { status: 500 })
    }
    // Anche questo ramo assegna un tag: se qualcuno riusa qui il nome
    // "Emettere fattura" (il tag esiste gia', quindi il lookup lo ritrova e
    // lo assegna) l'automazione deve scattare come nel toggle.
    const automazione = await automazioneTagFattura(supabase, body.clienteId, tag.nome as string)
    return NextResponse.json({
      tag: { id: tag.id, name: tag.nome, color: tag.colore, createdAt: tag.created_at },
      automazione,
    })
  }

  if (body.action === "update") {
    const patch: { nome?: string; colore?: string } = {}
    if (body.name?.trim()) patch.nome = body.name.trim()
    if (body.color) patch.colore = body.color
    const { error } = await supabase.from("tag").update(patch).eq("id", body.tagId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase.from("tag").delete().eq("id", body.tagId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
