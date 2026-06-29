import { NextResponse } from "next/server"
import type { ClienteRecord } from "@/lib/mock-data"
import { parseClientiSearchParams } from "@/lib/clienti/api-types"
import { queryClienti, createClienteRecord } from "@/lib/clienti/repository"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = parseClientiSearchParams(searchParams)
  const result = await queryClienti(params)

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ClienteRecord>
  if (!body || !body["Nome Clienti"]) {
    return NextResponse.json(
      { error: "Payload cliente non valido: campo 'Nome Clienti' obbligatorio" },
      { status: 400 },
    )
  }
  const created = await createClienteRecord(body)
  return NextResponse.json(created, { status: 201 })
}
