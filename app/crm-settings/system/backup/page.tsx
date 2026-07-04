"use client"

import { DatabaseBackup, ExternalLink, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

export default function BackupPage() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const projectRef = projectUrl
    ? new URL(projectUrl).hostname.split(".")[0]
    : null
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/database/backups`
    : "https://supabase.com/dashboard"

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Backup"
        description="Gestione dei backup del database tramite il provider Supabase."
      />
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <DatabaseBackup className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Backup del progetto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Stato, retention e ripristino sono gestiti direttamente nel pannello Supabase.
            </p>
          </div>
        </div>
        <div>
          <Button
            variant="outline"
            onClick={() => window.open(dashboardUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink />
            Apri gestione backup
          </Button>
        </div>
      </section>
      <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Il CRM non simula né dichiara backup completati: mostra esclusivamente le operazioni disponibili dal provider.
      </p>
    </div>
  )
}
