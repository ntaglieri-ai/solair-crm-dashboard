import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { downloadAdminFile } from "@/lib/nextcloud/admin-webdav"

export const runtime = "nodejs"

function isActive(value: { pubblicata: boolean; valido_dal: string | null; valido_al: string | null }) {
  if (!value.pubblicata) return false
  const today = new Date().toISOString().slice(0, 10)
  if (value.valido_dal && value.valido_dal > today) return false
  if (value.valido_al && value.valido_al < today) return false
  return true
}

function filename(title: string) {
  const clean = title.trim().replace(/[^a-z0-9._ -]+/gi, "").replace(/\s+/g, " ").slice(0, 120)
  return `${clean || "offerta"}.pdf`
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin client non configurato" }, { status: 503 })

  const { data, error } = await supabase
    .from("offerta_commerciale_offerte")
    .select("titolo, pdf_path, pubblicata, valido_dal, valido_al")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 })
  if (!isActive(data)) return NextResponse.json({ error: "Offerta non disponibile" }, { status: 404 })
  if (!data.pdf_path) return NextResponse.json({ error: "PDF non disponibile" }, { status: 404 })

  let file: Response
  try {
    file = await downloadAdminFile(data.pdf_path)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PDF non disponibile" }, { status: 502 })
  }

  return new Response(file.body, {
    headers: {
      "Content-Type": file.headers.get("content-type") ?? "application/pdf",
      ...(file.headers.get("content-length") ? { "Content-Length": file.headers.get("content-length")! } : {}),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename(data.titolo))}`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  })
}
