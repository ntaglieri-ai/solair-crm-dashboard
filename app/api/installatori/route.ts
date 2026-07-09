import { NextResponse } from "next/server"
import {
  createInstallatoreRecord,
  queryInstallatori,
  type InstallatoreInput,
} from "@/lib/installatori/repository"
import { parseInstallatoriSearchParams } from "@/lib/installatori/api-types"
import { requireApiRecord } from "@/lib/permissions/server"

export async function GET(request: Request) {
  const guard = await requireApiRecord("installatori", "view")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const params = parseInstallatoriSearchParams(searchParams)
  const result = await queryInstallatori(params)

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  })
}

export async function POST(request: Request) {
  const guard = await requireApiRecord("installatori", "create")
  if (guard.response) return guard.response

  const body = (await request.json()) as Partial<InstallatoreInput>
  if (!body || !body.nome?.trim()) {
    return NextResponse.json(
      { error: "Payload installatore non valido: campo 'nome' obbligatorio" },
      { status: 400 },
    )
  }

  const created = await createInstallatoreRecord({
    nome: body.nome.trim(),
    email: body.email ?? null,
    email_secondaria: body.email_secondaria ?? null,
    telefono: body.telefono ?? null,
    tag: body.tag ?? null,
    attivo: body.attivo ?? true,
    proprietario_id: body.proprietario_id ?? null,
    note: body.note ?? null,
  })
  return NextResponse.json(created, { status: 201 })
}
