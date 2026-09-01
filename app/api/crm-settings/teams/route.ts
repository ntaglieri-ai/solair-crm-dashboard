import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"

type TeamPayload = {
  id?: string
  nome?: string
  descrizione?: string
  attivo?: boolean
  agenteIds?: string[]
  direttoreIds?: string[]
}

async function guard() {
  return requireApiAction("crm_settings.account.users.manage")
}

export async function GET() {
  const access = await guard()
  if (access.response) return access.response
  const supabase = await createClient()
  const [teams, agents, directors, users] = await Promise.all([
    supabase.from("teams").select("id,nome,descrizione,attivo,created_at").order("nome"),
    supabase.from("team_agenti").select("team_id,utente_id"),
    supabase.from("team_direttori").select("team_id,utente_id"),
    supabase.from("utenti").select("id,nome,email,ruolo,ruolo_id,attivo").order("nome"),
  ])
  const error = teams.error ?? agents.error ?? directors.error ?? users.error
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    teams: (teams.data ?? []).map((team) => ({
      ...team,
      agenteIds: (agents.data ?? []).filter((row) => row.team_id === team.id).map((row) => row.utente_id),
      direttoreIds: (directors.data ?? []).filter((row) => row.team_id === team.id).map((row) => row.utente_id),
    })),
    users: users.data ?? [],
  })
}

async function saveRelations(teamId: string, body: TeamPayload) {
  const supabase = await createClient()
  const [removeAgents, removeDirectors] = await Promise.all([
    supabase.from("team_agenti").delete().eq("team_id", teamId),
    supabase.from("team_direttori").delete().eq("team_id", teamId),
  ])
  if (removeAgents.error) return removeAgents.error
  if (removeDirectors.error) return removeDirectors.error
  const agenteIds = [...new Set(body.agenteIds ?? [])]
  const direttoreIds = [...new Set(body.direttoreIds ?? [])]
  if (agenteIds.length) {
    // Un agente ha un solo team principale: selezionarlo qui lo sposta dal
    // team precedente senza richiedere una rimozione manuale separata.
    const detach = await supabase.from("team_agenti").delete().in("utente_id", agenteIds)
    if (detach.error) return detach.error
    const result = await supabase.from("team_agenti").insert(
      agenteIds.map((utente_id) => ({ team_id: teamId, utente_id })),
    )
    if (result.error) return result.error
  }
  if (direttoreIds.length) {
    const result = await supabase.from("team_direttori").insert(
      direttoreIds.map((utente_id) => ({ team_id: teamId, utente_id })),
    )
    if (result.error) return result.error
  }
  return null
}

export async function POST(request: Request) {
  const access = await guard()
  if (access.response) return access.response
  const body = (await request.json().catch(() => null)) as TeamPayload | null
  if (!body?.nome?.trim()) return NextResponse.json({ error: "Nome team obbligatorio" }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.from("teams").insert({
    nome: body.nome.trim(),
    descrizione: body.descrizione?.trim() || null,
    attivo: body.attivo !== false,
  }).select("id").single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Creazione non riuscita" }, { status: 500 })
  const relationError = await saveRelations(data.id, body)
  if (relationError) return NextResponse.json({ error: relationError.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const access = await guard()
  if (access.response) return access.response
  const body = (await request.json().catch(() => null)) as TeamPayload | null
  if (!body?.id || !body.nome?.trim()) return NextResponse.json({ error: "Team non valido" }, { status: 400 })
  const supabase = await createClient()
  const { error } = await supabase.from("teams").update({
    nome: body.nome.trim(),
    descrizione: body.descrizione?.trim() || null,
    attivo: body.attivo !== false,
    updated_at: new Date().toISOString(),
  }).eq("id", body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const relationError = await saveRelations(body.id, body)
  if (relationError) return NextResponse.json({ error: relationError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const access = await guard()
  if (access.response) return access.response
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Team non valido" }, { status: 400 })
  const supabase = await createClient()
  const { error } = await supabase.from("teams").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
