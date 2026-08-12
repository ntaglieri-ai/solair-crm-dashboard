import { NextResponse } from "next/server"
import { downloadFile } from "@/lib/nextcloud/admin-webdav"
import { corsHeaders } from "@/lib/public/cors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PREFISSI_CONSENTITI = ["Solair/Offerta-Commerciale/Pannelli/"]

function isPathConsentito(path: string): boolean {
  return PREFISSI_CONSENTITI.some((prefix) => path.startsWith(prefix))
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

  const result = await downloadFile(pathPulito)
  if (!result.ok || !result.body) {
    console.error(`[asset] download fallito per "${pathPulito}": ${result.error ?? `HTTP ${result.status}`}`)
    return NextResponse.json({ error: "File non trovato" }, { status: 404, headers })
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": result.contentType ?? "application/octet-stream",
      ...(result.contentLength ? { "Content-Length": result.contentLength } : {}),
    },
  })
}
