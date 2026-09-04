import { NextResponse } from "next/server"
import { requireApiNoteInterne } from "@/lib/clienti/note-interne-guard"
import { internalMentionUsers } from "@/lib/clienti/note-interne-mentions-server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireApiNoteInterne(id)
  if (guard.response) return guard.response
  try {
    const users = await internalMentionUsers(id)
    return NextResponse.json({ users: users.map(({ id, nome }) => ({ id, nome })) }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Verifica destinatari non disponibile" }, { status: 503 })
  }
}
