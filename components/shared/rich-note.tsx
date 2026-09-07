"use client"

import { useRef, type RefObject } from "react"
import { Bold, Italic, Link, List, Paperclip, X, Code2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MentionTextarea } from "@/components/shared/note-mentions"
import type { NoteAttachment, NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"

type RichNoteComposerProps = {
  value: string
  onChange: (value: string) => void
  mentions: NoteMentionDraft[]
  onMentionsChange: (mentions: NoteMentionDraft[]) => void
  files: File[]
  onFilesChange: (files: File[]) => void
  rows?: number
  placeholder?: string
  usersUrl?: string
  className?: string
  disabled?: boolean
}

function shiftMentions(
  mentions: NoteMentionDraft[],
  start: number,
  end: number,
  beforeLength: number,
  totalDelta: number,
) {
  return mentions.flatMap((mention) => {
    if (mention.end <= start) return [mention]
    if (mention.start >= end) {
      return [{ ...mention, start: mention.start + totalDelta, end: mention.end + totalDelta }]
    }
    if (mention.start >= start && mention.end <= end) {
      return [{ ...mention, start: mention.start + beforeLength, end: mention.end + beforeLength }]
    }
    return []
  })
}

function selectedRange(ref: RefObject<HTMLTextAreaElement | null>, fallback: number) {
  const start = ref.current?.selectionStart ?? fallback
  const end = ref.current?.selectionEnd ?? start
  return { start, end }
}

export function RichNoteComposer({
  value,
  onChange,
  mentions,
  onMentionsChange,
  files,
  onFilesChange,
  rows = 3,
  placeholder = "Aggiungi nota...",
  usersUrl,
  className,
  disabled = false,
}: RichNoteComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function replaceSelection(before: string, after = before, fallback = "") {
    const { start, end } = selectedRange(textareaRef, value.length)
    const selected = value.slice(start, end) || fallback
    const replacement = `${before}${selected}${after}`
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`
    onChange(next)
    onMentionsChange(shiftMentions(mentions, start, end, before.length, before.length + after.length))
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function prefixLine(prefix: string) {
    const { start } = selectedRange(textareaRef, value.length)
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`
    onChange(next)
    onMentionsChange(
      mentions.map((mention) =>
        mention.start >= lineStart
          ? { ...mention, start: mention.start + prefix.length, end: mention.end + prefix.length }
          : mention,
      ),
    )
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  function addLink() {
    const { start, end } = selectedRange(textareaRef, value.length)
    const selected = value.slice(start, end) || "link"
    const before = "["
    const after = "](https://)"
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(next)
    onMentionsChange(shiftMentions(mentions, start, end, before.length, before.length + after.length))
    requestAnimationFrame(() => {
      const urlStart = start + before.length + selected.length + 2
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(urlStart, urlStart + "https://".length)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1">
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => replaceSelection("**", "**", "testo")} title="Grassetto">
          <Bold className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => replaceSelection("*", "*", "testo")} title="Corsivo">
          <Italic className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => replaceSelection("`", "`", "testo")} title="Codice">
          <Code2 className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => prefixLine("- ")} title="Lista">
          <List className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={addLink} title="Link">
          <Link className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => fileRef.current?.click()} title="Allega file">
          <Paperclip className="size-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? [])
            if (selected.length > 0) onFilesChange([...files, ...selected])
            event.currentTarget.value = ""
          }}
        />
      </div>
      <MentionTextarea
        textareaRef={textareaRef}
        value={value}
        onChange={onChange}
        mentions={mentions}
        onMentionsChange={onMentionsChange}
        usersUrl={usersUrl}
        rows={rows}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-md bg-card px-2 py-1 text-xs text-muted-foreground">
              <Paperclip className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded-md hover:bg-secondary"
                onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Rimuovi ${file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function inlineNodes(text: string, mentions: NoteMention[], keyPrefix: string) {
  const nodes: React.ReactNode[] = []
  const sorted = mentions.toSorted((a, b) => a.start - b.start)
  let cursor = 0

  for (const mention of sorted) {
    if (mention.start < cursor || text.slice(mention.start, mention.end) !== `@${mention.name}`) continue
    nodes.push(...markdownInline(text.slice(cursor, mention.start), `${keyPrefix}-t-${cursor}`))
    nodes.push(
      <span key={`${keyPrefix}-m-${mention.userId}-${mention.start}`} className="font-semibold text-teal">
        @{mention.name}
      </span>,
    )
    cursor = mention.end
  }
  nodes.push(...markdownInline(text.slice(cursor), `${keyPrefix}-t-${cursor}`))
  return nodes
}

function markdownInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = []
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(text.slice(cursor, index))
    if (match[2] && match[3]) {
      nodes.push(
        <a key={`${keyPrefix}-l-${index}`} href={match[3]} target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">
          {match[2]}
        </a>,
      )
    } else if (match[4]) {
      nodes.push(<code key={`${keyPrefix}-c-${index}`} className="rounded bg-secondary px-1 py-0.5 text-[0.92em]">{match[4]}</code>)
    } else if (match[5]) {
      nodes.push(<strong key={`${keyPrefix}-b-${index}`}>{match[5]}</strong>)
    } else if (match[6]) {
      nodes.push(<em key={`${keyPrefix}-i-${index}`}>{match[6]}</em>)
    }
    cursor = index + match[0].length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

export function RichNoteText({
  text,
  mentions,
  className,
}: {
  text: string
  mentions?: NoteMention[]
  className?: string
}) {
  const lines = text.split(/\r?\n/).reduce<Array<{ line: string; start: number; end: number }>>(
    (acc, line) => {
      const start = acc.length === 0 ? 0 : acc[acc.length - 1].end + 1
      const end = start + line.length
      return [...acc, { line, start, end }]
    },
    [],
  )

  return (
    <div className={cn("space-y-1 whitespace-pre-wrap", className)}>
      {lines.map(({ line, start, end }, index) => {
        const lineMentions = (mentions ?? [])
          .filter((mention) => mention.start >= start && mention.end <= end)
          .map((mention) => ({ ...mention, start: mention.start - start, end: mention.end - start }))
        const list = line.match(/^\s*[-*]\s+(.+)$/)
        if (list) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-muted-foreground/70" />
              <span>{inlineNodes(list[1], lineMentions.map((mention) => ({ ...mention, start: Math.max(0, mention.start - (line.length - list[1].length)), end: Math.max(0, mention.end - (line.length - list[1].length)) })), `l-${index}`)}</span>
            </div>
          )
        }
        return <p key={index}>{inlineNodes(line, lineMentions, `l-${index}`)}</p>
      })}
    </div>
  )
}

export function NoteAttachmentList({
  allegati,
  recordTipo,
  recordId,
  nomeRecord,
}: {
  allegati?: NoteAttachment[]
  recordTipo: AllegatoRecordTipo
  recordId: string
  nomeRecord: string
}) {
  if (!allegati || allegati.length === 0) return null
  const query =
    `recordTipo=${encodeURIComponent(recordTipo)}` +
    `&recordId=${encodeURIComponent(recordId)}` +
    `&nomeRecord=${encodeURIComponent(nomeRecord)}`

  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {allegati.map((allegato) => (
        <li key={allegato.path}>
          <a
            href={`/api/allegati/file/download?path=${encodeURIComponent(allegato.path)}&${query}`}
            className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <Download className="size-3.5 shrink-0" />
            <span className="truncate">{allegato.nome}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
