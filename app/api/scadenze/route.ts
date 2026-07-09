import { NextResponse } from "next/server"
import {
  createScadenzaRecord,
  queryScadenze,
  type ScadenzaInput,
} from "@/lib/scadenze/repository"
import { parseScadenzeSearchParams } from "@/lib/scadenze/api-types"
import { requireApiRecord } from "@/lib/permissions/server"

export async function GET(request: Request) {
  const guard = await requireApiRecord("scadenze", "view")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const params = parseScadenzeSearchParams(searchParams)
  const result = await queryScadenze(params)

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  })
}

export async function POST(request: Request) {
  const guard = await requireApiRecord("scadenze", "create")
  if (guard.response) return guard.response

  const body = (await request.json()) as Partial<ScadenzaInput>
  if (!body || !body.nome?.trim() || !body.data_scadenza) {
    return NextResponse.json(
      { error: "Payload scadenza non valido: 'nome' e 'data_scadenza' obbligatori" },
      { status: 400 },
    )
  }

  const created = await createScadenzaRecord({
    nome: body.nome.trim(),
    data_scadenza: body.data_scadenza,
    proprietario_id: body.proprietario_id ?? null,
    descrizione: body.descrizione ?? null,
    connesso_a_id: body.connesso_a_id ?? null,
    connesso_a_tipo: body.connesso_a_tipo ?? null,
    tag: body.tag ?? null,
  })
  return NextResponse.json(created, { status: 201 })
}
