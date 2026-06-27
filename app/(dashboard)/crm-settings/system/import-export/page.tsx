"use client"

import { useRef, useState } from "react"
import { Upload, Download, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"

const MODULI_IMPORT = ["Lead", "Clienti", "Compiti"]
const MODULI_EXPORT = ["Lead", "Clienti", "Compiti", "Scadenze"]
const PERIODI = ["Tutti", "Ultimi 30gg", "Ultimi 90gg", "Personalizzato"]

export default function ImportExportPage() {
  const [importModulo, setImportModulo] = useState("Lead")
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [exportModulo, setExportModulo] = useState("Lead")
  const [periodo, setPeriodo] = useState("Tutti")

  function handleFiles(files: FileList | null) {
    const f = files?.[0]
    if (f) setFile(f)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Import / Export"
        description="Importa ed esporta dati dal CRM in formato CSV."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Import */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Upload className="size-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-foreground">Importa dati</h3>
              <p className="text-sm text-muted-foreground">
                Carica un file CSV per importare record nel CRM.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Modulo</Label>
            <Select
              value={importModulo}
              onValueChange={(v) => setImportModulo(v ?? "Lead")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULI_IMPORT.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="size-4 shrink-0 text-teal" />
                <span className="truncate font-medium text-foreground">
                  {file.name}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Rimuovi file"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFiles(e.dataTransfer.files)
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                dragOver
                  ? "border-teal bg-teal/5"
                  : "border-border hover:border-teal/50 hover:bg-muted/50",
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Trascina qui il file CSV
              </span>
              <span className="text-xs text-muted-foreground">
                oppure clicca per selezionarlo
              </span>
            </button>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1">
              <Download className="size-4" />
              Scarica template CSV
            </Button>
            <Button
              disabled={!file}
              className="flex-1 bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Avvia importazione
            </Button>
          </div>
        </div>

        {/* Export */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-navy/10 text-navy">
              <Download className="size-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-foreground">Esporta dati</h3>
              <p className="text-sm text-muted-foreground">
                Esporta i record del CRM in formato CSV.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Modulo</Label>
            <Select
              value={exportModulo}
              onValueChange={(v) => setExportModulo(v ?? "Lead")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULI_EXPORT.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Periodo</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v ?? "Tutti")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODI.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="mt-auto bg-teal text-teal-foreground hover:bg-teal/90">
            <Download className="size-4" />
            Esporta CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
