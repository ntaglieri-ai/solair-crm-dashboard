import { NextResponse } from "next/server"
import type { Compito } from "@/lib/mock-data"
import { parseCompitiSearchParams } from "@/lib/compiti/api-types"
import { queryCompiti, createCompitoRecord } from "@/lib/compiti/repository"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = parseCompitiSearchParams(searchParams)
  const result = await queryCompiti(params)

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Compito>
  if (!body || !body.Oggetto) {
    return NextResponse.json(
      { error: "Payload compito non valido: campo 'Oggetto' obbligatorio" },
      { status: 400 },
    )
  }
  const created = await createCompitoRecord(body)
  return NextResponse.json(created, { status: 201 })
}
