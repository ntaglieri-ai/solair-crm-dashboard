"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { Save, Check, Copy, Info, Users, Building2, Wrench } from "lucide-react"
import {
  CARTELLA_VARIABILI,
  PATH_TEMPLATES,
  previewPath,
  type PathTemplate,
} from "@/lib/file-manager-data"
import { cn } from "@/lib/utils"

const MODULO_ICON = {
  Lead: Users,
  Clienti: Building2,
  Installatori: Wrench,
} as const

export default function StrutturaPage() {
  const [templates, setTemplates] = useState<PathTemplate[]>(PATH_TEMPLATES)
  const [copied, setCopied] = useState<string | null>(null)
  const [savedRow, setSavedRow] = useState<string | null>(null)

  function copyVar(v: string) {
    navigator.clipboard?.writeText(v)
    setCopied(v)
    window.setTimeout(() => setCopied((c) => (c === v ? null : c)), 1200)
  }

  function updateTemplate(id: string, template: string) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, template } : t)),
    )
  }

  function saveRow(id: string) {
    setSavedRow(id)
    window.setTimeout(() => setSavedRow((s) => (s === id ? null : s)), 1200)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Struttura cartelle"
        description="Definisci i template di percorso per le cartelle collegate ai moduli CRM. Le variabili tra {} vengono sostituite automaticamente."
      />

      {/* Variabili disponibili */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variabili disponibili</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CARTELLA_VARIABILI.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => copyVar(v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs text-foreground transition-colors hover:border-teal hover:bg-teal/10"
              >
                {copied === v ? (
                  <Check className="size-3 text-teal" />
                ) : (
                  <Copy className="size-3 text-muted-foreground" />
                )}
                {v}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabella template */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Modulo</TableHead>
                <TableHead>Template percorso</TableHead>
                <TableHead>Esempio</TableHead>
                <TableHead className="w-16 text-right">Salva</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => {
                const Icon = MODULO_ICON[t.modulo]
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="size-4 text-muted-foreground" />
                        {t.modulo}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={t.template}
                        onChange={(e) => updateTemplate(t.id, e.target.value)}
                        className="font-mono text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {previewPath(t.modulo, t.template)}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Salva template ${t.modulo}`}
                        onClick={() => saveRow(t.id)}
                        className={cn(savedRow === t.id && "text-teal")}
                      >
                        {savedRow === t.id ? (
                          <Check className="size-4" />
                        ) : (
                          <Save className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          Le cartelle vengono create manualmente o tramite automazioni Make al
          momento della creazione del record.
        </p>
      </div>
    </div>
  )
}
