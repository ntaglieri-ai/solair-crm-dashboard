import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import {
  getPersonalEmailStatus,
  storePersonalEmailCredential,
} from "@/lib/email/personal-credentials"

export async function GET() {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = await getPersonalEmailStatus(subject.userId)
  return NextResponse.json(status)
}

type SavePayload = {
  smtpUser?: unknown
  smtpPassword?: unknown
}

export async function POST(request: Request) {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as SavePayload | null
  const smtpUser = typeof body?.smtpUser === "string" ? body.smtpUser.trim() : ""
  const smtpPassword = typeof body?.smtpPassword === "string" ? body.smtpPassword : ""

  if (!smtpUser || !smtpUser.includes("@")) {
    return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 })
  }
  if (!smtpPassword) {
    return NextResponse.json({ error: "Inserisci la password della casella." }, { status: 400 })
  }

  const { error } = await storePersonalEmailCredential({
    utenteId: subject.userId,
    smtpUser,
    smtpPassword,
    status: "active",
  })

  if (error) {
    return NextResponse.json({ error: `Salvataggio non riuscito: ${error}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, smtpUser })
}
