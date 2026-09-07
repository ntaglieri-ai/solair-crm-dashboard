"use client"

import { useState } from "react"
import { IconChevronDown, IconMail } from "@tabler/icons-react"
import type { EmailLogEntry } from "@/lib/email/email-log"
import { formatEmailLogDate } from "@/components/leads/email-log-format"
import { NoteAttachmentList, RichNoteText } from "@/components/shared/rich-note"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"
import { cn } from "@/lib/utils"

export function EmailHistorySection({
  emailLog,
  emptyLabel,
  recordTipo,
  recordId,
  nomeRecord,
}: {
  emailLog: EmailLogEntry[]
  emptyLabel: string
  recordTipo: AllegatoRecordTipo
  recordId: string
  nomeRecord: string
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <ul className="flex flex-col gap-2">
      {emailLog.length === 0 ? (
        <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </li>
      ) : null}
      {emailLog.map((email) => {
        const expanded = open[email.id] ?? false
        const hasBody = Boolean(email.corpo?.trim())
        const hasAttachments = email.allegati.length > 0

        return (
          <li key={email.id} className="rounded-lg border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              onClick={() => setOpen((current) => ({ ...current, [email.id]: !expanded }))}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <IconMail size={16} stroke={1.8} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {email.oggetto}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {[
                    formatEmailLogDate(email.dataInvio),
                    `a ${email.destinatario}`,
                    `da ${email.fromEmail}`,
                    email.inviataDaNome ? `inviata da ${email.inviataDaNome}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <IconChevronDown
                size={16}
                stroke={1.8}
                className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
              />
            </button>
            {expanded ? (
              <div className="border-t border-border px-3 py-3">
                {hasBody ? (
                  <RichNoteText text={email.corpo ?? ""} className="text-[13px] text-foreground" />
                ) : (
                  <p className="text-[13px] text-muted-foreground">Corpo email non registrato.</p>
                )}
                {hasAttachments ? (
                  <NoteAttachmentList
                    allegati={email.allegati}
                    recordTipo={recordTipo}
                    recordId={recordId}
                    nomeRecord={nomeRecord}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
