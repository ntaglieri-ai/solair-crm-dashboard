"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MittenteSelect, useMittenti } from "@/components/shared/mittente-select"
import type { NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"

type MentionUser = { id: string; nome: string }

const AVATAR_TONES = [
  "bg-teal/15 text-teal ring-teal/20",
  "bg-blue-100 text-blue-700 ring-blue-200",
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-violet-100 text-violet-700 ring-violet-200",
] as const

function avatarTone(name: string) {
  const index = [...name].reduce((total, char) => total + char.charCodeAt(0), 0) % AVATAR_TONES.length
  return AVATAR_TONES[index]
}

let mentionUsersPromise: Promise<MentionUser[]> | null = null

function loadMentionUsers() {
  if (!mentionUsersPromise) {
    mentionUsersPromise = fetch("/api/mentions/users")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Utenti non disponibili")))
      .then((body: { users?: MentionUser[] }) => body.users ?? [])
      .catch((error) => {
        mentionUsersPromise = null
        throw error
      })
  }
  return mentionUsersPromise
}

export function MentionTextarea({
  value,
  onChange,
  mentions,
  onMentionsChange,
  className,
  rows = 2,
  placeholder,
  usersUrl = "/api/mentions/users",
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  mentions: NoteMentionDraft[]
  onMentionsChange: (mentions: NoteMentionDraft[]) => void
  className?: string
  rows?: number
  placeholder?: string
  usersUrl?: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [userList, setUserList] = useState<{ url: string; users: MentionUser[]; failed: boolean } | null>(null)
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null)
  const [active, setActive] = useState(0)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0, width: 320 })

  useEffect(() => {
    let current = true
    // Le liste riservate sono per scheda e non entrano nella cache globale.
    const request = usersUrl === "/api/mentions/users" ? loadMentionUsers()
      : fetch(usersUrl, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Utenti non disponibili")
        return ((await response.json()) as { users?: MentionUser[] }).users ?? []
      })
    request.then((users) => { if (current) setUserList({ url: usersUrl, users, failed: false }) })
      .catch(() => { if (current) setUserList({ url: usersUrl, users: [], failed: true }) })
    return () => { current = false }
  }, [usersUrl])

  const filtered = useMemo(() => {
    if (!query || userList?.url !== usersUrl) return []
    const term = query.text.toLocaleLowerCase("it")
    return userList.users.filter((user) => user.nome.toLocaleLowerCase("it").includes(term)).slice(0, 8)
  }, [query, userList, usersUrl])

  useEffect(() => {
    if (!query) return
    function reposition() {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(280, rect.width)
      setPopupPosition({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - width - 12),
        width,
      })
    }
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [query])

  function updateQuery(text: string, cursor: number) {
    const before = text.slice(0, cursor)
    const match = before.match(/(?:^|\s)@([^@\s]*)$/)
    setQuery(match ? { start: cursor - match[1].length - 1, text: match[1] } : null)
    if (match && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const width = Math.max(280, rect.width)
      setPopupPosition({
        top: rect.bottom + 6,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      })
    }
    setActive(0)
  }

  function handleChange(next: string, cursor: number) {
    const previous = value
    let prefix = 0
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
    let oldSuffix = previous.length
    let newSuffix = next.length
    while (oldSuffix > prefix && newSuffix > prefix && previous[oldSuffix - 1] === next[newSuffix - 1]) {
      oldSuffix--
      newSuffix--
    }
    const delta = (newSuffix - prefix) - (oldSuffix - prefix)
    onMentionsChange(mentions.flatMap((mention) => {
      if (mention.end <= prefix) return [mention]
      if (mention.start >= oldSuffix) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }]
      return []
    }))
    onChange(next)
    updateQuery(next, cursor)
  }

  function selectUser(user: MentionUser) {
    if (!query) return
    const cursor = ref.current?.selectionStart ?? value.length
    const inserted = `@${user.nome}`
    const next = `${value.slice(0, query.start)}${inserted} ${value.slice(cursor)}`
    const end = query.start + inserted.length
    const delta = inserted.length + 1 - (cursor - query.start)
    onChange(next)
    onMentionsChange([
      ...mentions.map((mention) => mention.start >= cursor
        ? { ...mention, start: mention.start + delta, end: mention.end + delta }
        : mention),
      { userId: user.id, start: query.start, end },
    ])
    setQuery(null)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(end + 1, end + 1)
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!query || filtered.length === 0) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      selectUser(filtered[active])
    } else if (event.key === "Escape") {
      event.preventDefault()
      setQuery(null)
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        className={className}
        onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
        onClick={(event) => updateQuery(value, event.currentTarget.selectionStart)}
        onKeyDown={handleKeyDown}
      />
      {!disabled && query && filtered.length === 0 ? <p role="status" className="mt-1 text-xs text-muted-foreground">
        {userList?.url !== usersUrl ? "Caricamento utenti…" : userList.failed
          ? "Impossibile caricare gli utenti da menzionare. Riprova riaprendo la nota."
          : "Nessun utente disponibile per questa menzione."}
      </p> : null}
      {!disabled && query && filtered.length > 0 && typeof document !== "undefined" ? createPortal(
        <div
          role="listbox"
          aria-label="Utenti CRM da menzionare"
          className="fixed z-[200] max-h-72 overflow-auto rounded-xl border border-teal/30 bg-popover p-1.5 shadow-[0_18px_45px_-12px_rgba(15,118,110,0.38)] ring-1 ring-teal/10"
          style={popupPosition}
        >
          <div className="mb-1 flex items-center justify-between rounded-lg bg-gradient-to-r from-teal/15 via-teal/8 to-blue-500/10 px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal">Utenti CRM</span>
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{filtered.length}</span>
          </div>
          {filtered.map((user, index) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={index === active}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                index === active ? "bg-teal text-white shadow-sm" : "hover:bg-teal/10",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectUser(user)}
            >
              <span className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-inset",
                index === active ? "bg-white/20 text-white ring-white/25" : avatarTone(user.nome),
              )}>
                {user.nome.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
              </span>
              <span className="truncate font-semibold">{user.nome}</span>
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

export function MentionText({ text, mentions, className, allowEmail = true }: { text: string; mentions?: NoteMention[]; className?: string; allowEmail?: boolean }) {
  const valid = (mentions ?? []).toSorted((a, b) => a.start - b.start)
  const [selected, setSelected] = useState<NoteMention | null>(null)
  const parts: React.ReactNode[] = []
  let cursor = 0
  valid.forEach((mention) => {
    if (mention.start < cursor || text.slice(mention.start, mention.end) !== `@${mention.name}`) return
    parts.push(text.slice(cursor, mention.start))
    parts.push(
      allowEmail ? <button key={`${mention.userId}-${mention.start}`} type="button" className="font-semibold text-teal hover:underline" onClick={() => setSelected(mention)}>
        {mention.name}
      </button> : <span key={`${mention.userId}-${mention.start}`} className="font-semibold text-teal">@{mention.name}</span>,
    )
    cursor = mention.end
  })
  parts.push(text.slice(cursor))
  return (
    <>
      <p className={cn("whitespace-pre-wrap", className)}>{parts}</p>
      {allowEmail ? <UserEmailDialog mention={selected} onOpenChange={(open) => !open && setSelected(null)} /> : null}
    </>
  )
}

function UserEmailDialog({ mention, onOpenChange }: { mention: NoteMention | null; onOpenChange: (open: boolean) => void }) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const mittenti = useMittenti(Boolean(mention))
  async function send() {
    if (!mention || !subject.trim()) return
    setSending(true)
    try {
      const response = await fetch(`/api/mentions/users/${mention.userId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, mittenteId: mittenti.selectedId }),
      })
      const result = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error ?? "Invio non riuscito")
      toast.success(`Email inviata a ${mention.name}`)
      setSubject("")
      setBody("")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invio non riuscito")
    } finally {
      setSending(false)
    }
  }
  return (
    <Dialog open={Boolean(mention)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scrivi a {mention?.name}</DialogTitle>
          <DialogDescription>Invia un’email all’utente CRM menzionato.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <MittenteSelect state={mittenti} disabled={sending} />
          <div className="flex flex-col gap-1.5"><Label htmlFor="mention-email-subject">Oggetto</Label><Input id="mention-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="mention-email-body">Messaggio</Label><Textarea id="mention-email-body" rows={5} value={body} onChange={(event) => setBody(event.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button disabled={!subject.trim() || sending} onClick={send}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} {sending ? "Invio..." : "Invia"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
