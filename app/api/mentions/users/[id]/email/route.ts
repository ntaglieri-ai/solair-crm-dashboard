import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { sendDirectEmail } from "@/lib/email/mailer"
import { resolveSender } from "@/lib/email/sender-accounts"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const permissions = await getCurrentPermissions()
  if (!permissions.snapshot.subject.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { subject?: string; body?: string; mittenteId?: string | null } | null
  const subject = body?.subject?.trim()
  const message = body?.body?.trim() ?? ""
  if (!subject) return NextResponse.json({ error: "Oggetto obbligatorio" }, { status: 400 })

  const supabase = await createClient()
  const { data: user, error } = await supabase
    .from("utenti")
    .select("nome,email")
    .eq("id", id)
    .eq("attivo", true)
    .maybeSingle()
  if (error || !user?.email) {
    return NextResponse.json({ error: "Utente o indirizzo email non disponibile" }, { status: 404 })
  }

  const sender = await resolveSender({
    utenteId: permissions.snapshot.subject.userId,
    accountId: body?.mittenteId,
  })
  if (!sender.ok) return NextResponse.json({ error: sender.error }, { status: 403 })
  const result = await sendDirectEmail({ to: user.email, subject, body: message, fromEmail: sender.sender.fromEmail })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ ok: true })
}
