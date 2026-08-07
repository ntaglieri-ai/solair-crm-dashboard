import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_GRAPH_API_VERSION = "v21.0"
const ALLOWED_ROLES = new Set(["ADMIN", "SUPERADMIN"])
// Pagina gia' collegata al webhook Lead Ads (SolairGroup). Sovrascrivibile da
// env quando la Pagina attiva cambiera'.
const DEFAULT_ACTIVE_PAGE_ID = "113871998412187"
// Limite di sicurezza sul numero di richieste seguite via paging.next.
const MAX_GRAPH_REQUESTS = 5

type MetaPage = {
  id: string
  name: string
  category: string | null
  picture_url: string | null
}

type GraphPage = {
  id?: unknown
  name?: unknown
  category?: unknown
  picture?: { data?: { url?: unknown } }
}

/**
 * Elenco in sola lettura delle Pagine Facebook collegate al Business Manager.
 * Usa il permesso `pages_show_list` del Page Access Token gia' configurato per
 * il webhook Lead Ads: nessuna scrittura e nessuna persistenza su Supabase.
 */
export async function GET() {
  const permissions = await getCurrentPermissions()
  const { authUserId, ruoloCode } = permissions.snapshot.subject

  if (!authUserId) {
    return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 })
  }
  if (
    !ALLOWED_ROLES.has(ruoloCode.toUpperCase()) ||
    !permissions.canPage("crm_settings.system.meta")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const accessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim()
  if (!accessToken) {
    return NextResponse.json(
      { error: "META_PAGE_ACCESS_TOKEN non configurato" },
      { status: 503 },
    )
  }

  const graphVersion =
    process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION
  const url = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`)
  url.searchParams.set("fields", "id,name,category,picture.type(square){url}")
  url.searchParams.set("limit", "100")
  url.searchParams.set("access_token", accessToken)

  const pages: MetaPage[] = []
  let next: string | null = url.toString()
  let requests = 0

  while (next && requests < MAX_GRAPH_REQUESTS) {
    requests += 1

    let response: Response
    try {
      response = await fetch(next, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      return NextResponse.json(
        { error: "Meta Graph API non raggiungibile, riprovare piu' tardi" },
        { status: 502 },
      )
    }

    const body = (await response.json().catch(() => null)) as unknown

    if (!response.ok) return graphErrorResponse(response.status, body)
    if (!isRecord(body) || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: "Risposta Meta non valida" },
        { status: 502 },
      )
    }

    for (const item of body.data) {
      const page = normalizePage(item, graphVersion)
      if (page) pages.push(page)
    }

    next = readNextCursor(body)
  }

  return NextResponse.json({
    activePageId:
      process.env.META_ACTIVE_PAGE_ID?.trim() || DEFAULT_ACTIVE_PAGE_ID,
    pages,
  })
}

/**
 * Traduce l'errore Graph in un messaggio leggibile: token scaduto/revocato
 * (codici 190/102 o HTTP 401) va distinto dagli altri fallimenti, perche' e'
 * l'unico che si risolve rigenerando META_PAGE_ACCESS_TOKEN.
 */
function graphErrorResponse(status: number, body: unknown) {
  const graphError = isRecord(body) && isRecord(body.error) ? body.error : null
  const code = typeof graphError?.code === "number" ? graphError.code : null
  const message =
    typeof graphError?.message === "string" ? graphError.message : null

  if (status === 401 || code === 190 || code === 102) {
    return NextResponse.json(
      {
        error:
          "Token Meta non valido o scaduto, verificare META_PAGE_ACCESS_TOKEN",
      },
      { status: 401 },
    )
  }

  return NextResponse.json(
    { error: message ?? `Meta Graph API: HTTP ${status}` },
    { status: 502 },
  )
}

function normalizePage(value: unknown, graphVersion: string): MetaPage | null {
  if (!isRecord(value)) return null

  const page = value as GraphPage
  const id = typeof page.id === "string" ? page.id.trim() : ""
  if (!id) return null

  const name = typeof page.name === "string" ? page.name.trim() : ""
  const pictureUrl = page.picture?.data?.url

  return {
    id,
    name: name || `Pagina ${id}`,
    category: typeof page.category === "string" ? page.category : null,
    // Se l'espansione `picture` non arriva, l'endpoint pubblico della foto
    // profilo Pagina resta comunque raggiungibile senza token.
    picture_url:
      typeof pictureUrl === "string" && pictureUrl
        ? pictureUrl
        : `https://graph.facebook.com/${graphVersion}/${id}/picture?type=square`,
  }
}

function readNextCursor(body: Record<string, unknown>) {
  const paging = isRecord(body.paging) ? body.paging : null
  const next = typeof paging?.next === "string" ? paging.next : null
  if (!next) return null

  try {
    // Il cursore arriva dalla risposta remota: si segue solo se punta ancora
    // a Graph.
    return new URL(next).hostname === "graph.facebook.com" ? next : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
