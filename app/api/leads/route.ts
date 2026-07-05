import { NextResponse } from "next/server"
import type { Lead } from "@/lib/mock-data"
import { parseLeadsSearchParams } from "@/lib/leads/api-types"
import { queryLeads, createLeadRecord } from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"

export async function GET(request: Request) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const params = parseLeadsSearchParams(searchParams)
    const result = await queryLeads(params)
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore caricamento Lead"
    console.error("[api/leads]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireApiRecord("lead", "create")
  if (guard.response) return guard.response

  const body = (await request.json()) as Lead
  if (!body || !body.id || !body["Nome Lead"]) {
    return NextResponse.json(
      { error: "Payload lead non valido" },
      { status: 400 },
    )
  }
  const created = await createLeadRecord(body)
  return NextResponse.json(created, { status: 201 })
}
