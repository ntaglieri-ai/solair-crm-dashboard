import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { downloadFile } from "@/lib/nextcloud/admin-webdav"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiPage("offerta_commerciale")
  if (guard.response) return guard.response
  const { id } = await context.params
  const kind = new URL(request.url).searchParams.get("kind") === "cover" ? "cover_path" : "pdf_path"
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  const { data, error } = await supabase.from("offerta_commerciale_offerte").select(`${kind}, titolo`).eq("id", id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 })
  const path = data[kind as keyof typeof data]
  if (typeof path !== "string" || !path) return NextResponse.json({ error: "File non disponibile" }, { status: 404 })
  const file = await downloadFile(path)
  if (!file.ok || !file.body) return NextResponse.json({ error: file.error ?? "File non disponibile" }, { status: file.status || 502 })
  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType ?? (kind === "pdf_path" ? "application/pdf" : "application/octet-stream"),
      ...(file.contentLength ? { "Content-Length": file.contentLength } : {}),
      "Content-Disposition": `inline; filename="${encodeURIComponent(String(data.titolo))}${kind === "pdf_path" ? ".pdf" : ""}"`,
      "Cache-Control": "private, max-age=300",
    },
  })
}
