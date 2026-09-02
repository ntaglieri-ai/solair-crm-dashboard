export type NoteMention = {
  userId: string
  name: string
  start: number
  end: number
}

export type NoteMentionDraft = Pick<NoteMention, "userId" | "start" | "end">

export function sanitizeNoteMentions(
  text: string,
  drafts: NoteMentionDraft[],
  users: Array<{ id: string; nome: string }>,
): NoteMention[] {
  const byId = new Map(users.map((user) => [user.id, user.nome]))
  const seen = new Set<string>()

  return drafts
    .toSorted((a, b) => a.start - b.start)
    .flatMap((draft) => {
      const name = byId.get(draft.userId)
      const key = `${draft.userId}:${draft.start}:${draft.end}`
      if (!name || seen.has(key) || draft.start < 0 || draft.end > text.length) return []
      if (text.slice(draft.start, draft.end) !== `@${name}`) return []
      seen.add(key)
      return [{ ...draft, name }]
    })
}
