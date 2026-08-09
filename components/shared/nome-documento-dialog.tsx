"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Convenzione nomi documenti (spec FASE 5.3):
 *   {TipoDocumento}_{Cognome}_{AAAAMMGG}
 * es. Fattura_Rossi_20260815, AccordoFirmato_Bianchi_20260812.
 *
 * Il dialog PROPONE il nome, non lo impone: l'agente puo' correggerlo prima
 * del caricamento. Nessuna rinomina retroattiva sui file gia' su Nextcloud —
 * la convenzione vale dai nuovi upload in avanti.
 */

/**
 * Tipi ricorrenti, ricavati dai campi che il CRM gia' tiene sul Cliente:
 * Fattura1/2/PDC, Bonifico1/2/PDC, Tot Contratto, Mappa catastale,
 * Regolamento di esercizio, Attestato Terna, Scheda ENEA, Tica — piu' i due
 * esempi della spec (AccordoFirmato, DocumentoIdentita) e la scheda tecnica
 * che gira fra ufficio e installatore nelle fasi 3.4 e 4.1.
 *
 * Non e' un enum chiuso: il campo nome resta libero, quindi un documento fuori
 * elenco non ha bisogno di una voce qui per essere caricato col nome giusto.
 */
export const TIPI_DOCUMENTO = [
  "Fattura",
  "Contratto",
  "AccordoFirmato",
  "DocumentoIdentita",
  "Bonifico",
  "Preventivo",
  "SchedaTecnica",
  "SchedaSopralluogo",
  "MappaCatastale",
  "RegolamentoEsercizio",
  "AttestatoTerna",
  "SchedaEnea",
  "Tica",
  "Bolletta",
] as const

const TIPI_ITEMS = Object.fromEntries(TIPI_DOCUMENTO.map((t) => [t, t]))

/**
 * Separa il nome dall'estensione. L'estensione non entra mai nel campo
 * modificabile: e' cio' che rende apribile il file, e un nome corretto a mano
 * e' esattamente il posto in cui si perde per sbaglio.
 */
export function splitEstensione(nomeFile: string): { base: string; estensione: string } {
  const punto = nomeFile.lastIndexOf(".")
  if (punto <= 0) return { base: nomeFile, estensione: "" }
  return { base: nomeFile.slice(0, punto), estensione: nomeFile.slice(punto) }
}

/**
 * Ripulisce un pezzo del nome: via i caratteri illegali su file system e via
 * gli spazi (uniti in PascalCase). Gli underscore sono i separatori dei tre
 * campi, quindi non possono sopravvivere dentro un campo: "De Luca" diventa
 * "DeLuca", altrimenti "Fattura_De Luca_20260815" avrebbe due significati.
 */
function compatta(valore: string): string {
  return valore
    .replace(/[\\/:*?"<>|_]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((parola) => parola.charAt(0).toUpperCase() + parola.slice(1))
    .join("")
}

/** Da "2026-08-15" (input date) a "20260815". */
function compattaData(dataIso: string): string {
  return dataIso.replace(/-/g, "")
}

export function buildNomeDocumento(tipo: string, cognome: string, dataIso: string): string {
  return [compatta(tipo), compatta(cognome), compattaData(dataIso)].filter(Boolean).join("_")
}

function oggiIso(): string {
  const ora = new Date()
  const mese = String(ora.getMonth() + 1).padStart(2, "0")
  const giorno = String(ora.getDate()).padStart(2, "0")
  return `${ora.getFullYear()}-${mese}-${giorno}`
}

export function NomeDocumentoDialog({
  file,
  cognome,
  uploading,
  onConfirm,
  onCancel,
}: {
  /** File scelto dall'utente, in attesa di conferma del nome. null = dialog chiuso. */
  file: File | null
  cognome: string
  uploading: boolean
  /** Riceve il nome completo di estensione, pronto per l'upload. */
  onConfirm: (nomeFile: string) => void
  onCancel: () => void
}) {
  const [tipo, setTipo] = useState<string>(TIPI_DOCUMENTO[0])
  const [cognomeDraft, setCognomeDraft] = useState(cognome)
  const [data, setData] = useState(oggiIso())
  // Il nome NON e' stato copiato: finche' resta null si legge dai tre campi.
  // Diventa una stringa solo quando l'agente lo corregge a mano, e da li' in
  // poi vince lui — altrimenti il primo cambio di tipo cancellerebbe quello
  // che ha appena scritto.
  const [nomeManuale, setNomeManuale] = useState<string | null>(null)
  const [fileVisto, setFileVisto] = useState(file)

  // Ogni file riparte pulito: tipo di default, cognome dal record, data di
  // oggi. Senza questo reset il secondo upload erediterebbe le scelte del
  // primo, che e' il modo piu' facile per caricare due file con lo stesso nome.
  // Aggiustamento di stato in render (non in effect) come da pattern React per
  // i valori derivati da una prop cambiata: evita il render in piu'.
  if (file !== fileVisto) {
    setFileVisto(file)
    if (file) {
      setTipo(TIPI_DOCUMENTO[0])
      setCognomeDraft(cognome)
      setData(oggiIso())
      setNomeManuale(null)
    }
  }

  const estensione = file ? splitEstensione(file.name).estensione : ""
  const suggerito = buildNomeDocumento(tipo, cognomeDraft, data)
  const manuale = nomeManuale !== null
  const nome = nomeManuale ?? suggerito
  const nomeFinale = `${nome.trim()}${estensione}`

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(aperto) => {
        if (!aperto && !uploading) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nome del documento</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo documento</Label>
            <Select items={TIPI_ITEMS} value={tipo} onValueChange={(v) => setTipo(v as string)}>
              <SelectTrigger className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {TIPI_DOCUMENTO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-cognome">Cognome</Label>
              <Input
                id="doc-cognome"
                value={cognomeDraft}
                onChange={(e) => setCognomeDraft(e.target.value)}
                placeholder="Rossi"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-data">Data caricamento</Label>
              <Input
                id="doc-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-nome">Nome file</Label>
            <div className="flex items-center gap-2">
              <Input
                id="doc-nome"
                value={nome}
                onChange={(e) => setNomeManuale(e.target.value)}
                className="flex-1"
              />
              {estensione ? (
                <span className="text-[13px] text-muted-foreground">{estensione}</span>
              ) : null}
            </div>
            {manuale ? (
              <button
                type="button"
                onClick={() => setNomeManuale(null)}
                className="self-start text-[11px] text-navy hover:underline"
              >
                Torna al nome suggerito ({suggerito})
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Convenzione: TipoDocumento_Cognome_AAAAMMGG
              </span>
            )}
          </div>
          {file ? (
            <span className="truncate text-[11px] text-muted-foreground">
              File originale: {file.name}
            </span>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={uploading}>
            Annulla
          </Button>
          <Button onClick={() => onConfirm(nomeFinale)} disabled={uploading || !nome.trim()}>
            {uploading ? "Caricamento..." : "Carica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
