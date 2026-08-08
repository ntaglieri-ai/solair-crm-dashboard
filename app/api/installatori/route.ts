import { NextResponse, after } from "next/server"
import {
  createInstallatoreRecord,
  queryInstallatori,
  type InstallatoreInput,
} from "@/lib/installatori/repository"
import {
  normalizeCanalePreferito,
  parseInstallatoriSearchParams,
} from "@/lib/installatori/api-types"
import { requireApiRecord } from "@/lib/permissions/server"
import { ensureFolder } from "@/lib/nextcloud/admin-webdav"
import { folderPathForRecord } from "@/lib/allegati/paths"

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
    canale_preferito: normalizeCanalePreferito(body.canale_preferito),
    proprietario_id: body.proprietario_id ?? null,
    note: body.note ?? null,
  })

  // Cartella Nextcloud creata subito (non al primo upload) cosi' e'
  // raggiungibile anche da PC/telefono senza passare dal CRM — sempre in
  // background, mai bloccante (decisione 25/07, stesso pattern di Lead).
  after(async () => {
    const path = folderPathForRecord("installatore", created.id, created.nome)
    const result = await ensureFolder(path)
    if (!result.ok) {
      console.error(`[allegati] creazione cartella installatore ${created.id} fallita:`, result.error)
    }
  })

  return NextResponse.json(created, { status: 201 })
}
