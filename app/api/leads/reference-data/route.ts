import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  requireApiAction,
  requireApiPage,
} from "@/lib/permissions/server"

type TagAction =
  | { action: "toggle"; leadId: string; tagId: string; enabled: boolean }
  | { action: "create_assign"; leadId: string; name: string; color: string }
  | { action: "update"; tagId: string; name?: string; color?: string }
  | { action: "delete"; tagId: string }

async function allAssignments() {
  const supabase = await createClient()
  const rows: Array<{ lead_id: string; tag_id: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("lead_tags")
      .select("lead_id,tag_id")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function GET() {
  const guard = await requireApiPage("lead")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const [tagsResult, ownersResult, installersResult, assignments] =
    await Promise.all([
      supabase
        .from("tag")
        .select("id,nome,colore")
        .eq("modulo", "lead")
        .order("nome"),
      supabase
        .from("utenti")
        .select("id,nome")
        .eq("attivo", true)
        .order("nome"),
      supabase
        .from("installatori")
        .select("id,nome")
        .eq("attivo", true)
        .order("nome"),
      allAssignments(),
    ])

  const error = tagsResult.error ?? ownersResult.error ?? installersResult.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    tags: (tagsResult.data ?? []).map((tag) => ({
      id: tag.id,
      name: tag.nome,
      color: tag.colore,
    })),
    leadTagIds: assignments.reduce<Record<string, string[]>>(
      (result, assignment) => {
        ;(result[assignment.lead_id] ??= []).push(assignment.tag_id)
        return result
      },
      {},
    ),
    owners: ownersResult.data ?? [],
    installers: installersResult.data ?? [],
  })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("lead.tags.edit")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as TagAction | null
  if (!body?.action) {
    return NextResponse.json({ error: "Azione tag non valida" }, { status: 400 })
  }

  const supabase = await createClient()

  if (body.action === "toggle") {
    if (!body.leadId || !body.tagId) {
      return NextResponse.json({ error: "Lead o tag non valido" }, { status: 400 })
    }
    const query = supabase
      .from("lead_tags")
      .delete()
      .eq("lead_id", body.leadId)
      .eq("tag_id", body.tagId)
    const { error } = body.enabled
      ? await supabase
          .from("lead_tags")
          .upsert(
            { lead_id: body.leadId, tag_id: body.tagId },
            { onConflict: "lead_id,tag_id" },
          )
      : await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "create_assign") {
    const name = body.name?.trim()
    if (!name || !body.leadId) {
      return NextResponse.json({ error: "Nome tag o lead non valido" }, { status: 400 })
    }
    const lookup = await supabase
      .from("tag")
      .select("id,nome,colore")
      .eq("modulo", "lead")
      .ilike("nome", name)
      .maybeSingle()
    if (lookup.error) {
      return NextResponse.json({ error: lookup.error.message }, { status: 500 })
    }
    let tag = lookup.data

    if (!tag) {
      const created = await supabase
        .from("tag")
        .insert({
          nome: name,
          colore: body.color || "#64748b",
          modulo: "lead",
        })
        .select("id,nome,colore")
        .single()
      if (created.error) {
        return NextResponse.json({ error: created.error.message }, { status: 500 })
      }
      tag = created.data
    }

    const assigned = await supabase
      .from("lead_tags")
      .upsert(
        { lead_id: body.leadId, tag_id: tag.id },
        { onConflict: "lead_id,tag_id" },
      )
    if (assigned.error) {
      return NextResponse.json({ error: assigned.error.message }, { status: 500 })
    }
    return NextResponse.json({
      tag: { id: tag.id, name: tag.nome, color: tag.colore },
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
