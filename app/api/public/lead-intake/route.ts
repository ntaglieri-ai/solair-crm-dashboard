import { NextResponse, after } from "next/server"
import { ensureFolder } from "@/lib/nextcloud/admin-webdav"
import { folderPathForRecord } from "@/lib/allegati/paths"
import {
  ingestLead,
  normalizeLeadIntakePayload,
  type LeadIntakeOrigine,
  type LeadIntakePayload,
} from "@/lib/leads/public-intake"

const KEY_BY_ORIGINE: Record<LeadIntakeOrigine, string | undefined> = {
  chatbot: process.env.LEAD_INTAKE_KEY_CHATBOT,
  meta_ads: process.env.LEAD_INTAKE_KEY_PABBLY,
  configuratore: process.env.LEAD_INTAKE_KEY_CONFIGURATORE,
  manuale: process.env.LEAD_INTAKE_KEY_MANUALE,
}

const VALID_ORIGINI: LeadIntakeOrigine[] = ["chatbot", "meta_ads", "configuratore", "manuale"]
const VALID_TIPI_DOCUMENTO = ["preventivo", "contratto"] as const

function isValidOrigine(value: unknown): value is LeadIntakeOrigine {
  return typeof value === "string" && (VALID_ORIGINI as string[]).includes(value)
}

function isValidTipoDocumento(value: unknown) {
  return typeof value === "string" && (VALID_TIPI_DOCUMENTO as readonly string[]).includes(value)
}

export async function POST(request: Request) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Body non valido, atteso JSON" }, { status: 400 })
  }

  const body = normalizeLeadIntakePayload(rawBody)

  if (!isValidOrigine(body.origine)) {
    return NextResponse.json(
      { error: `Campo "origine" mancante o non valido. Valori ammessi: ${VALID_ORIGINI.join(", ")}` },
      { status: 400 },
    )
  }

  const expectedKey = KEY_BY_ORIGINE[body.origine]
  const authHeader = request.headers.get("authorization") ?? ""
  const bearerKey = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const providedKey =
    bearerKey ||
    request.headers.get("x-api-key")?.trim() ||
    authHeader.trim()

  if (!expectedKey) {
    console.error(`[lead-intake] Nessuna API key configurata per origine "${body.origine}"`)
    return NextResponse.json({ error: "Sorgente non configurata" }, { status: 503 })
  }
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  if (!body.nome || !body.telefono) {
    return NextResponse.json({ error: "Campi obbligatori mancanti: nome, telefono" }, { status: 400 })
  }

  if (body.tipo_documento !== undefined && !isValidTipoDocumento(body.tipo_documento)) {
    return NextResponse.json(
      { error: 'Campo "tipo_documento" non valido. Valori ammessi: preventivo, contratto' },
      { status: 400 },
    )
  }

  try {
    const result = await ingestLead(body as LeadIntakePayload)

    if (result.skipped) {
      return NextResponse.json(
        {
          skipped: true,
          reason: result.skipReason,
          sourceCreatedAt: result.sourceCreatedAt,
        },
        { status: 202 },
      )
    }

    if (!result.duplicate) {
      after(async () => {
        if (!result.id) return
        const path = folderPathForRecord("lead", result.id, result.nomeLead)
        const folderResult = await ensureFolder(path)
        if (!folderResult.ok) {
          console.error(`[lead-intake] creazione cartella lead ${result.id} fallita:`, folderResult.error)
        }
      })
    }

    return NextResponse.json(
      { id: result.id, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore ingestion lead"
    console.error("[lead-intake]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
