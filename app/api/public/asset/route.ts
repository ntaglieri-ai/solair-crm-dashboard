import { NextResponse } from "next/server"
import { downloadFile } from "@/lib/nextcloud/webdav"
import { corsHeaders } from "@/lib/public/cors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PREFISSI_CONSENTITI = ["Solair/Offerta-Commerciale/Pannelli/"]

function isPathConsentito(path: string): boolean {
  return PREFISSI_CONSENTITI.some((prefix) => path.startsWith(prefix))
}

function assetCredentials(): { username: string; appPassword: string } | null {
  const username = process.env.NEXTCLOUD_ASSET_USER
  const appPassword = process.env.NEXTCLOUD_ASSET_PASSWORD
  if (!username || !appPassword) return null
  return { username, appPassword }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: Request) {
  const headers = {
    ...corsHeaders(request),
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  }

  const path = new URL(request.url).searchParams.get("path") ?? ""
  const pathPulito = decodeURIComponent(path).replace(/^\/+/, "")

  if (!pathPulito || pathPulito.includes("..") || !isPathConsentito(pathPulito)) {
    return NextResponse.json({ error: "Path non valido o non consentito" }, { status: 400, headers })
  }

  const creds = assetCredentials()
  if (!creds) {
    console.error("[asset] NEXTCLOUD_ASSET_USER / NEXTCLOUD_ASSET_PASSWORD non configurate")
    return NextResponse.json({ error: "Servizio non disponibile" }, { status: 503, headers })
  }

  try {
    const res = await downloadFile(creds.username, creds.appPassword, pathPulito)
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
        ...(res.headers.get("content-length")
          ? { "Content-Length": res.headers.get("content-length")! }
          : {}),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore download Nextcloud"
    console.error(`[asset] download fallito per "${pathPulito}": ${message}`)
    return NextResponse.json({ error: "File non trovato" }, { status: 404, headers })
  }
}