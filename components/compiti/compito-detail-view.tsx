"use client"

import { useState } from "react"
import Link from "next/link"
import {
  IconClock,
  IconCalendarEvent,
  IconBellRinging,
  IconMapPin,
  IconUser,
  IconLink,
  IconMessagePlus,
  IconCircleCheck,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type Compito,
  type CompitoNota,
  formatCompitoNotaData,
  isCompitoScaduto,
} from "@/lib/mock-data"
import { CompitoDetailHeader } from "./compito-detail-header"
import { StatoBadge, PrioritaBadge, CompitoAvatar, correlatoHref } from "./compito-utils"

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof IconClock
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={17} stroke={1.8} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground">{children}</span>
      </div>
    </div>
  )
}

export function CompitoDetailView({ compito }: { compito: Compito }) {
  const [note, setNote] = useState<CompitoNota[]>(compito.Note)
  const [draft, setDraft] = useState("")
  const [notaSaving, setNotaSaving] = useState(false)
  const scaduto = isCompitoScaduto(compito)

  const addNota = async () => {
    const testo = draft.trim()
    if (!testo || notaSaving) return
    setNotaSaving(true)
    try {
      const res = await fetch(`/api/compiti/${compito.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testo }),
      })
      if (!res.ok) throw new Error("Salvataggio non riuscito")
      const saved = (await res.json()) as {
        id: string
        testo: string | null
        created_at: string | null
        autore: string | null
      }
      const nota: CompitoNota = {
        id: saved.id,
        testo: saved.testo ?? testo,
        autore: saved.autore ?? "Utente CRM",
        data: formatCompitoNotaData(saved.created_at ?? ""),
      }
      setNote((prev) => [nota, ...prev])
      setDraft("")
      toast.success("Nota aggiunta")
    } catch {
      toast.error("Errore nel salvataggio della nota")
    } finally {
      setNotaSaving(false)
    }
  }

  // Timeline derivata dagli eventi del compito
  const timeline = [
    {
      id: "t-create",
      icon: IconCalendarEvent,
      titolo: "Compito creato",
      data: compito["Data di creazione"],
    },
    ...(compito.Promemoria
      ? [
          {
            id: "t-rem",
            icon: IconBellRinging,
            titolo: "Promemoria impostato",
            data: compito.Promemoria,
          },
        ]
      : []),
    ...note.map((n) => ({
      id: n.id,
      icon: IconMessagePlus,
      titolo: `Nota di ${n.autore}`,
      data: n.data,
      testo: n.testo,
    })),
    ...(compito["Orario di chiusura"]
      ? [
          {
            id: "t-close",
            icon: IconCircleCheck,
            titolo: "Compito completato",
            data: compito["Orario di chiusura"],
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-4">
        <div className="overflow-hidden rounded-xl border border-border">
          <CompitoDetailHeader compito={compito} />
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_320px]">
        {/* Colonna principale: tabs */}
        <div className="min-w-0">
          <Tabs defaultValue="panoramica">
            <TabsList variant="line" className="border-b border-border">
              <TabsTrigger value="panoramica">Panoramica</TabsTrigger>
              <TabsTrigger value="sequenza">
                Sequenza temporale
              </TabsTrigger>
            </TabsList>

            {/* PANORAMICA */}
            <TabsContent value="panoramica" className="pt-5">
              <div className="flex flex-col gap-6">
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-foreground">
                    Descrizione
                  </h2>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {compito.Descrizione || "Nessuna descrizione fornita."}
                  </p>
                </section>

                {/* Note */}
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-foreground">
                    Note
                  </h2>
                  <div className="flex flex-col gap-2">
                    <Textarea
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Aggiungi una nota…"
                      className="bg-card"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!draft.trim() || notaSaving}
                        onClick={addNota}
                      >
                        <IconMessagePlus size={15} stroke={1.8} data-icon="inline-start" />
                        Aggiungi nota
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {note.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                        Nessuna nota presente.
                      </p>
                    ) : (
                      note.map((n) => (
                        <div
                          key={n.id}
                          className="flex gap-3 rounded-lg border border-border bg-card p-3"
                        >
                          <CompitoAvatar nome={n.autore} size={32} />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {n.autore}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {n.data}
                              </span>
                            </div>
                            <p className="text-pretty text-sm text-muted-foreground">
                              {n.testo}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </TabsContent>

            {/* SEQUENZA TEMPORALE */}
            <TabsContent value="sequenza" className="pt-5">
              <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
                {timeline.map((ev) => {
                  const Icon = ev.icon
                  return (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[31px] flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                        <Icon size={13} stroke={1.8} />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {ev.titolo}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {ev.data}
                          </span>
                        </div>
                        {"testo" in ev && ev.testo ? (
                          <p className="text-pretty text-sm text-muted-foreground">
                            {ev.testo}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side panel dettagli */}
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-1 text-sm font-semibold text-foreground">
              Dettagli
            </h2>
            <div className="divide-y divide-border">
              <InfoRow icon={IconClock} label="Stato">
                <StatoBadge stato={compito.Stato} />
              </InfoRow>
              <InfoRow icon={IconClock} label="Priorità">
                <PrioritaBadge priorita={compito.Priorità} />
              </InfoRow>
              <InfoRow icon={IconCalendarEvent} label="Data di scadenza">
                <span className={cn(scaduto && "font-medium text-destructive")}>
                  {compito["Data di scadenza"]}
                  {scaduto ? " · Scaduto" : ""}
                </span>
              </InfoRow>
              {compito.Promemoria && (
                <InfoRow icon={IconBellRinging} label="Promemoria">
                  {compito.Promemoria}
                </InfoRow>
              )}
              <InfoRow icon={IconUser} label="Proprietario">
                <span className="inline-flex items-center gap-2">
                  <CompitoAvatar
                    nome={compito["Proprietario del compito"]}
                    size={22}
                  />
                  {compito["Proprietario del compito"]}
                </span>
              </InfoRow>
              <InfoRow icon={IconMapPin} label="Sede">
                {compito.Sede}
              </InfoRow>
              {compito["Correlato a"] && (
                <InfoRow icon={IconLink} label="Correlato a">
                  {compito["Correlato a"].linkable ? (
                    <Link
                      href={correlatoHref(compito["Correlato a"])}
                      className="font-medium text-info hover:underline"
                    >
                      {compito["Correlato a"].nome}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {compito["Correlato a"].nome}
                    </span>
                  )}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({compito["Correlato a"].tipo})
                  </span>
                </InfoRow>
              )}
              <InfoRow icon={IconCalendarEvent} label="Creato il">
                {compito["Data di creazione"]}
              </InfoRow>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
