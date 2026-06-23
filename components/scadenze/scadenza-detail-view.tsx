"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconChevronUp,
  IconChevronDown,
  IconNote,
  IconLink,
  IconPaperclip,
  IconMail,
  IconActivity,
  IconCircleCheck,
  IconCalendarEvent,
  IconMessagePlus,
  IconPlus,
  IconDownload,
  IconPencil,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  type Scadenza,
  type ScadenzaNota,
} from "@/lib/mock-data"
import { ScadenzaDetailHeader } from "./scadenza-detail-header"
import { ScadenzaFormDialog } from "./scadenza-form-dialog"
import { ScadenzaAvatar } from "./scadenza-utils"

const RELATED_NAV = [
  { id: "note", label: "Note", icon: IconNote },
  { id: "record", label: "Record collegati", icon: IconLink },
  { id: "allegati", label: "Allegati", icon: IconPaperclip },
  { id: "email", label: "E-mail", icon: IconMail },
  { id: "aperte", label: "Attività aperte", icon: IconActivity },
  { id: "chiuse", label: "Attività chiuse", icon: IconCircleCheck },
]

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function FieldCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

export function ScadenzaDetailView({
  scadenza,
  prevId,
  nextId,
}: {
  scadenza: Scadenza
  prevId: string | null
  nextId: string | null
}) {
  const router = useRouter()
  const [record, setRecord] = useState<Scadenza>(scadenza)
  const [note, setNote] = useState<ScadenzaNota[]>(scadenza.Note)
  const [noteSort, setNoteSort] = useState("recente")
  const [draft, setDraft] = useState("")
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(scadenza.Descrizione ?? "")
  const [emailTab, setEmailTab] = useState("messaggi")
  const [editOpen, setEditOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(`sez-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  const addNota = () => {
    if (!draft.trim()) return
    const now = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    const nota: ScadenzaNota = {
      id: `n-${Date.now()}`,
      testo: draft.trim(),
      autore: record["Proprietario di Scadenze"],
      data: `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`,
    }
    setNote((prev) => [nota, ...prev])
    setDraft("")
    toast.success("Nota aggiunta")
  }

  const sortedNote = [...note].sort((a, b) =>
    noteSort === "recente"
      ? b.data.localeCompare(a.data)
      : a.data.localeCompare(b.data),
  )

  const saveDesc = () => {
    setRecord((prev) => ({ ...prev, Descrizione: descDraft.trim() || null }))
    setEditingDesc(false)
    toast.success("Descrizione aggiornata")
  }

  // Timeline derivata
  const timeline = [
    {
      id: "t-create",
      icon: IconCalendarEvent,
      titolo: "Scadenza creata",
      data: record["Ora creazione"],
    },
    {
      id: "t-due",
      icon: IconCalendarEvent,
      titolo: "Data scadenza prevista",
      data: record["Data scadenza"],
    },
    ...note.map((n) => ({
      id: n.id,
      icon: IconMessagePlus,
      titolo: `Nota di ${n.autore}`,
      data: n.data,
      testo: n.testo,
    })),
    {
      id: "t-mod",
      icon: IconActivity,
      titolo: "Ultima modifica",
      data: record["Ora modifica"],
    },
  ].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="flex flex-col">
      {/* Navigazione prev/next */}
      <div className="flex items-center justify-end gap-1.5 px-6 pt-4">
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-card"
          aria-label="Scadenza precedente"
          disabled={!prevId}
          onClick={() => prevId && router.push(`/scadenze/${prevId}`)}
        >
          <IconChevronUp size={16} stroke={1.8} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-card"
          aria-label="Scadenza successiva"
          disabled={!nextId}
          onClick={() => nextId && router.push(`/scadenze/${nextId}`)}
        >
          <IconChevronDown size={16} stroke={1.8} />
        </Button>
      </div>

      <div className="px-6 pt-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <ScadenzaDetailHeader
            scadenza={record}
            onEdit={() => setEditOpen(true)}
            onDelete={() => {
              toast.success("Scadenza eliminata")
              router.push("/scadenze")
            }}
          />
        </div>
      </div>

      <div className="px-6 py-5">
        <Tabs defaultValue="panoramica">
          <TabsList variant="line" className="border-b border-border">
            <TabsTrigger value="panoramica">Panoramica</TabsTrigger>
            <TabsTrigger value="sequenza">Sequenza temporale</TabsTrigger>
          </TabsList>

          {/* PANORAMICA */}
          <TabsContent value="panoramica" className="pt-5">
            <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
              {/* Elenco correlato (nav verticale) */}
              <aside className="lg:sticky lg:top-5 lg:self-start">
                <nav className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-2">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Elenco correlato
                  </p>
                  {RELATED_NAV.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollTo(item.id)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                      >
                        <Icon size={16} stroke={1.8} className="text-muted-foreground" />
                        {item.label}
                      </button>
                    )
                  })}
                </nav>
              </aside>

              {/* Contenuto principale */}
              <div className="flex min-w-0 flex-col gap-6">
                {/* Informazioni su Scadenze */}
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-2 text-sm font-semibold text-foreground">
                    Informazioni su Scadenze
                  </h2>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <FieldCell label="Nome Scadenze">
                      {record["Nome Scadenze"]}
                    </FieldCell>
                    <FieldCell label="Proprietario di Scadenze">
                      <span className="inline-flex items-center gap-2">
                        <ScadenzaAvatar
                          nome={record["Proprietario di Scadenze"]}
                          size={22}
                        />
                        {record["Proprietario di Scadenze"]}
                      </span>
                    </FieldCell>
                    <FieldCell label="Data scadenza">
                      {record["Data scadenza"]}
                    </FieldCell>
                    <FieldCell label="Caricamento file 1">
                      {record["Caricamento file 1"] ? (
                        <a
                          href="#"
                          className="inline-flex items-center gap-1.5 text-info hover:underline"
                        >
                          <IconDownload size={14} stroke={1.8} />
                          {record["Caricamento file 1"]}
                        </a>
                      ) : (
                        "—"
                      )}
                    </FieldCell>
                  </div>
                </section>

                {/* Nuova sezione 1 */}
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      Nuova sezione 1
                    </h2>
                    {!editingDesc && (
                      <button
                        type="button"
                        onClick={() => {
                          setDescDraft(record.Descrizione ?? "")
                          setEditingDesc(true)
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
                      >
                        <IconPencil size={13} stroke={2} />
                        Modifica
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">Descrizione</span>
                  {editingDesc ? (
                    <div className="mt-1.5 flex flex-col gap-2">
                      <Textarea
                        rows={3}
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingDesc(false)}
                        >
                          Annulla
                        </Button>
                        <Button size="sm" onClick={saveDesc}>
                          Salva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-foreground">
                      {record.Descrizione || "Nessuna descrizione fornita."}
                    </p>
                  )}
                </section>

                {/* Note */}
                <section id="sez-note" className="scroll-mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      Note
                    </h2>
                    <Select
                      value={noteSort}
                      onValueChange={(v) => setNoteSort(v ?? "recente")}
                    >
                      <SelectTrigger className="h-8 w-[160px] bg-card" aria-label="Ordina note">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="recente">Ultimo recente</SelectItem>
                          <SelectItem value="vecchio">Meno recente</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Textarea
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Aggiungi una nota…"
                      className="bg-card"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" disabled={!draft.trim()} onClick={addNota}>
                        <IconMessagePlus size={15} stroke={1.8} data-icon="inline-start" />
                        Aggiungi nota
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {sortedNote.length === 0 ? (
                      <EmptyState>Nessuna nota presente.</EmptyState>
                    ) : (
                      sortedNote.map((n) => (
                        <div
                          key={n.id}
                          className="flex gap-3 rounded-lg border border-border bg-card p-3"
                        >
                          <ScadenzaAvatar nome={n.autore} size={32} />
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

                {/* Record collegati */}
                <section id="sez-record" className="scroll-mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      Record collegati
                    </h2>
                    <Button size="sm" variant="outline" className="bg-card">
                      <IconPlus size={15} stroke={1.8} data-icon="inline-start" />
                      Aggiungi nuovo
                    </Button>
                  </div>
                  {record["Connesso a"] ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-navy/10 text-navy">
                        <IconLink size={16} stroke={1.8} />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {record["Connesso a"]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Connesso a
                        </span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState>Nessun record trovato</EmptyState>
                  )}
                </section>

                {/* Allegati */}
                <section id="sez-allegati" className="scroll-mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      Allegati
                    </h2>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="sm" variant="outline" className="bg-card">
                            <IconPaperclip size={15} stroke={1.8} data-icon="inline-start" />
                            Allega
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem>Da computer</DropdownMenuItem>
                        <DropdownMenuItem>Da URL</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {record["Caricamento file 1"] ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <IconPaperclip size={16} stroke={1.8} />
                      </span>
                      <a
                        href="#"
                        className="flex-1 text-sm font-medium text-info hover:underline"
                      >
                        {record["Caricamento file 1"]}
                      </a>
                      <IconDownload
                        size={16}
                        stroke={1.8}
                        className="text-muted-foreground"
                      />
                    </div>
                  ) : (
                    <EmptyState>Nessun allegato</EmptyState>
                  )}
                </section>

                {/* E-mail */}
                <section id="sez-email" className="scroll-mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      E-mail
                    </h2>
                    <Button size="sm" variant="outline" className="bg-card">
                      <IconMail size={15} stroke={1.8} data-icon="inline-start" />
                      Scrivi e-mail
                    </Button>
                  </div>
                  <Tabs value={emailTab} onValueChange={setEmailTab}>
                    <TabsList variant="line" className="border-b border-border">
                      <TabsTrigger value="messaggi">Messaggi</TabsTrigger>
                      <TabsTrigger value="bozze">Bozze</TabsTrigger>
                      <TabsTrigger value="pianificata">Pianificata</TabsTrigger>
                    </TabsList>
                    <TabsContent value="messaggi" className="pt-3">
                      <EmptyState>Nessun record trovato</EmptyState>
                    </TabsContent>
                    <TabsContent value="bozze" className="pt-3">
                      <EmptyState>Nessun record trovato</EmptyState>
                    </TabsContent>
                    <TabsContent value="pianificata" className="pt-3">
                      <EmptyState>Nessun record trovato</EmptyState>
                    </TabsContent>
                  </Tabs>
                </section>

                {/* Attività aperte */}
                <section id="sez-aperte" className="scroll-mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      Attività aperte
                    </h2>
                    <Button size="sm" variant="outline" className="bg-card">
                      <IconPlus size={15} stroke={1.8} data-icon="inline-start" />
                      Compito
                    </Button>
                  </div>
                  <EmptyState>Nessun record trovato</EmptyState>
                </section>

                {/* Attività chiuse */}
                <section id="sez-chiuse" className="scroll-mt-5">
                  <h2 className="mb-2 text-sm font-semibold text-foreground">
                    Attività chiuse
                  </h2>
                  <EmptyState>Nessun record trovato</EmptyState>
                </section>
              </div>
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

      <ScadenzaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        scadenza={record}
        onSave={(updated) => {
          setRecord(updated)
          setNote(updated.Note)
          toast.success("Scadenza aggiornata", {
            description: updated["Nome Scadenze"],
          })
        }}
      />
    </div>
  )
}
