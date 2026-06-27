import { NextResponse } from "next/server"
import type { Lead } from "@/lib/mock-data"
import { parseLeadsSearchParams } from "@/lib/leads/api-types"
import { queryLeads, createLeadRecord } from "@/lib/leads/repository"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = parseLeadsSearchParams(searchParams)
  const result = await queryLeads(params)
  return NextResponse.json(result)
}

export async function POST(request: Request) {
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
