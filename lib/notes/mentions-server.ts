import { sendMentionNotificationEmail } from "@/lib/email/mailer"
import { sanitizeNoteMentions, type NoteMention, type NoteMentionDraft } from "./mentions"
import type { SupabaseClient } from "@supabase/supabase-js"

type SupabaseLike = Pick<SupabaseClient, "from">

export async function resolveNoteMentions(
  supabase: SupabaseLike,
  text: string,
  drafts: NoteMentionDraft[],
): Promise<{ mentions: NoteMention[]; recipients: Array<{ id: string; nome: string; email: string }> }> {
  const ids = [...new Set(drafts.map((mention) => mention.userId))]
  if (ids.length === 0) return { mentions: [], recipients: [] }

  const { data, error } = await supabase
    .from("utenti")
    .select("id,nome,email")
    .eq("attivo", true)
    .in("id", ids)
  if (error) throw new Error(`Verifica menzioni non riuscita: ${error.message}`)

  const users = (data ?? []) as Array<{ id: string; nome: string; email: string | null }>
  const mentions = sanitizeNoteMentions(text, drafts, users)
  const mentionedIds = new Set(mentions.map((mention) => mention.userId))
  return {
    mentions,
    recipients: users.flatMap((user) =>
      mentionedIds.has(user.id) && user.email
        ? [{ id: user.id, nome: user.nome, email: user.email }]
        : [],
    ),
  }
}

export async function notifyMentionedUsers(params: {
  recipients: Array<{ id: string; nome: string; email: string }>
  authorId: string | null
  authorName: string
  text: string
  recordLabel: string
  recordUrl: string
}) {
  const recipients = params.recipients.filter((recipient) => recipient.id !== params.authorId)
  const results = await Promise.all(
    recipients.map((recipient) =>
      sendMentionNotificationEmail({
        to: recipient.email,
        recipientName: recipient.nome,
        authorName: params.authorName,
        noteText: params.text,
        recordLabel: params.recordLabel,
        recordUrl: params.recordUrl,
      }),
    ),
  )
  return results.filter((result) => !result.ok).length
}

export function absoluteCrmUrl(request: Request, pathname: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
  return `${configured || new URL(request.url).origin}${pathname}`
}
