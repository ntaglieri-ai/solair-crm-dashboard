"use client"

import { useState } from "react"
import {
  Mail,
  ArrowRightLeft,
  StickyNote,
  Star,
  FileText,
  ImageIcon,
  UploadCloud,
  Download,
  Plus,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldTitle,
  FieldDescription,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Lead, LeadAttivita, LeadDocumento } from "@/lib/mock-data"

const ATTIVITA_ICONS: Record<LeadAttivita["tipo"], typeof Mail> = {
  "email-open": Mail,
  "cambio-stato": ArrowRightLeft,
  nota: StickyNote,
  "nuovo-lead": Star,
}

const ATTIVITA_TONE: Record<LeadAttivita["tipo"], string> = {
  "email-open": "bg-info/10 text-info",
  "cambio-stato": "bg-navy/10 text-navy",
  nota: "bg-warning/10 text-warning",
  "nuovo-lead": "bg-teal/10 text-teal",
}

const DOC_ICONS: Record<LeadDocumento["formato"], typeof FileText> = {
  pdf: FileText,
  jpg: ImageIcon,
  png: ImageIcon,
  dwg: FileText,
}

function AnagraficaTab({ lead }: { lead: Lead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anagrafica</CardTitle>
        <CardDescription>Dati di contatto del lead</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" defaultValue={lead.nome} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cognome">Cognome</FieldLabel>
              <Input id="cognome" defaultValue={lead.cognome} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" defaultValue={lead.email} />
            </Field>
            <Field>
              <FieldLabel htmlFor="telefono">Telefono</FieldLabel>
              <Input id="telefono" defaultValue={lead.telefono} />
            </Field>
            <Field>
              <FieldLabel htmlFor="citta">Città</FieldLabel>
              <Input id="citta" defaultValue={lead.citta} />
            </Field>
            <Field>
              <FieldLabel htmlFor="provincia">Provincia</FieldLabel>
              <Input id="provincia" defaultValue={lead.provincia} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cap">CAP</FieldLabel>
              <Input id="cap" defaultValue={lead.cap} />
            </Field>
            <Field>
              <FieldLabel htmlFor="indirizzo">Indirizzo</FieldLabel>
              <Input id="indirizzo" defaultValue={lead.indirizzo} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="note">Note</FieldLabel>
            <Textarea
              id="note"
              rows={4}
              defaultValue={lead.note}
              placeholder="Aggiungi note sul lead…"
            />
          </Field>
          <div className="flex justify-end">
            <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
              Salva modifiche
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function ConfigurazioneTab({ lead }: { lead: Lead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurazione preventivo</CardTitle>
        <CardDescription>Specifiche tecniche dell&apos;impianto</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="kwp">Potenza (kWp)</FieldLabel>
              <Input id="kwp" defaultValue={lead.kwp} />
            </Field>
            <Field>
              <FieldLabel htmlFor="kwh">Accumulo (kWh)</FieldLabel>
              <Input id="kwh" defaultValue={lead.kwh} />
            </Field>
            <Field>
              <FieldLabel htmlFor="modello">Modello pannello</FieldLabel>
              <Input id="modello" defaultValue={lead.modelloPannello} />
            </Field>
            <Field>
              <FieldLabel htmlFor="tipo">Tipo impianto</FieldLabel>
              <Input
                id="tipo"
                defaultValue={lead.tipoImpianto === "trifase" ? "Trifase" : "Monofase"}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="zona">Zona</FieldLabel>
              <Input id="zona" defaultValue={lead.zona} />
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign">Campaign name (origine)</FieldLabel>
              <Input id="campaign" defaultValue={lead.campaignName} />
            </Field>
          </div>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Wallbox richiesto</FieldTitle>
              <FieldDescription>
                Colonnina di ricarica per veicolo elettrico
              </FieldDescription>
            </FieldContent>
            <Switch defaultChecked={lead.wallbox} />
          </Field>

          <div className="flex justify-end">
            <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
              Salva configurazione
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function AttivitaTab({ lead }: { lead: Lead }) {
  const [nota, setNota] = useState("")
  const attivita = lead.attivita ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attività</CardTitle>
        <CardDescription>Cronologia eventi del lead</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Aggiungi nota */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Scrivi una nota commerciale…"
            className="bg-card"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={nota.trim() === ""}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => setNota("")}
            >
              <Plus data-icon="inline-start" />
              Aggiungi nota
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex flex-col">
          {attivita.map((att, i) => {
            const Icon = ATTIVITA_ICONS[att.tipo]
            const isLast = i === attivita.length - 1
            return (
              <div key={att.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      ATTIVITA_TONE[att.tipo],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
                </div>
                <div className={cn("flex flex-col pb-5", isLast && "pb-0")}>
                  <span className="text-sm font-medium text-foreground">
                    {att.descrizione}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {att.timestamp}
                    {att.autore ? ` · ${att.autore}` : ""}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function DocumentiTab({ lead }: { lead: Lead }) {
  const documenti = lead.documenti ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documenti</CardTitle>
        <CardDescription>Allegati e file del lead</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Dropzone */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/40 px-4 py-8 text-center">
          <UploadCloud className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Trascina un documento qui
          </p>
          <p className="text-xs text-muted-foreground">
            oppure
          </p>
          <Button size="sm" variant="outline" className="bg-card">
            Carica documento
          </Button>
        </div>

        {/* Lista documenti */}
        {documenti.length > 0 ? (
          <div className="flex flex-col gap-2">
            {documenti.map((doc) => {
              const Icon = DOC_ICONS[doc.formato]
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {doc.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {doc.dataUpload} · {doc.dimensione}
                    </span>
                  </div>
                  <Badge className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase text-muted-foreground">
                    {doc.formato}
                  </Badge>
                  <Button size="icon" variant="ghost" aria-label="Scarica">
                    <Download />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nessun documento allegato.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function LeadTabs({ lead }: { lead: Lead }) {
  return (
    <Tabs defaultValue="anagrafica" className="w-full">
      <TabsList>
        <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
        <TabsTrigger value="configurazione">Configurazione</TabsTrigger>
        <TabsTrigger value="attivita">Attività</TabsTrigger>
        <TabsTrigger value="documenti">Documenti</TabsTrigger>
      </TabsList>
      <TabsContent value="anagrafica" className="mt-4">
        <AnagraficaTab lead={lead} />
      </TabsContent>
      <TabsContent value="configurazione" className="mt-4">
        <ConfigurazioneTab lead={lead} />
      </TabsContent>
      <TabsContent value="attivita" className="mt-4">
        <AttivitaTab lead={lead} />
      </TabsContent>
      <TabsContent value="documenti" className="mt-4">
        <DocumentiTab lead={lead} />
      </TabsContent>
    </Tabs>
  )
}
