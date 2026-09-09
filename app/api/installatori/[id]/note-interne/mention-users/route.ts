import { NextResponse } from "next/server"
import { requireApiNoteInterne } from "@/lib/notes/note-interne-guard"
import { NOTE_INTERNE_INSTALLATORI as CONFIG } from "@/lib/notes/note-interne-config"
import { internalMentionUsers } from "@/lib/notes/note-interne-mentions-server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireApiNoteInterne(CONFIG, id)
  if (guard.response) return guard.response
  try {
    const users = await internalMentionUsers(CONFIG, id)
    return NextResponse.json({ users: users.map(({ id, nome }) => ({ id, nome })) }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Verifica destinatari non disponibile" }, { status: 503 })
  }
}
