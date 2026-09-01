"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type User = { id: string; nome: string; email: string; ruolo: string; attivo: boolean }
type Team = { id: string; nome: string; descrizione: string | null; attivo: boolean; agenteIds: string[]; direttoreIds: string[] }
type Draft = Omit<Team, "id"> & { id?: string }
const emptyDraft: Draft = { nome: "", descrizione: "", attivo: true, agenteIds: [], direttoreIds: [] }

export function TeamManagementClient() {
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const response = await fetch("/api/crm-settings/teams", { cache: "no-store" })
    const body = await response.json()
    if (!response.ok) toast.error(body.error ?? "Caricamento team non riuscito")
    else { setTeams(body.teams ?? []); setUsers(body.users ?? []) }
    setLoading(false)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  // I ruoli sono configurabili: non leghiamo la composizione del team ai soli
  // codici di sistema AGENT/DIRECTOR. Vito puo' usare anche profili duplicati.
  const directors = useMemo(() => users.filter((u) => u.attivo), [users])
  const agents = useMemo(() => users.filter((u) => u.attivo), [users])

  function toggle(key: "agenteIds" | "direttoreIds", id: string) {
    setDraft((current) => current ? ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }) : current)
  }

  async function save() {
    if (!draft?.nome.trim()) return
    const response = await fetch("/api/crm-settings/teams", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return toast.error(body.error ?? "Salvataggio non riuscito")
    toast.success("Team salvato")
    setDraft(null)
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/crm-settings/teams?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!response.ok) return toast.error("Eliminazione non riuscita")
    toast.success("Team eliminato")
    setDraft(null)
    await load()
  }

  return <div className="flex flex-col gap-6 pt-28 md:pt-24">
    <SectionHeader title="Team" description="Organizza gli agenti e assegna i Direttori. I team sono indipendenti dalle sedi." action={<Button onClick={() => setDraft({ ...emptyDraft })}><Plus className="size-4" />Nuovo team</Button>} />
    {loading ? <p className="text-sm text-muted-foreground">Caricamento…</p> : teams.length === 0 ?
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground"><Users className="mx-auto mb-3 size-8" />Nessun team configurato. Gli utenti restano non assegnati.</div> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teams.map((team) => <Card key={team.id} className="cursor-pointer" onClick={() => setDraft({ ...team, descrizione: team.descrizione ?? "" })}><CardHeader><CardTitle>{team.nome}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground"><p>{team.descrizione || "Nessuna descrizione"}</p><p className="mt-3">{team.agenteIds.length} agenti · {team.direttoreIds.length} direttori</p></CardContent></Card>)}</div>}
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?.id ? "Modifica team" : "Nuovo team"}</DialogTitle></DialogHeader>{draft && <div className="grid gap-5"><div className="grid gap-2"><Label>Nome</Label><Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} /></div><div className="grid gap-2"><Label>Descrizione</Label><Input value={draft.descrizione ?? ""} onChange={(e) => setDraft({ ...draft, descrizione: e.target.value })} /></div><label className="flex items-center justify-between"><span>Team attivo</span><Switch checked={draft.attivo} onCheckedChange={(value) => setDraft({ ...draft, attivo: value })} /></label><UserChoices title="Direttori" users={directors} selected={draft.direttoreIds} onToggle={(id) => toggle("direttoreIds", id)} /><UserChoices title="Agenti" users={agents} selected={draft.agenteIds} onToggle={(id) => toggle("agenteIds", id)} /></div>}<DialogFooter>{draft?.id && <Button variant="destructive" onClick={() => void remove(draft.id!)}>Elimina</Button>}<Button variant="outline" onClick={() => setDraft(null)}>Annulla</Button><Button onClick={() => void save()}>Salva</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function UserChoices({ title, users, selected, onToggle }: { title: string; users: User[]; selected: string[]; onToggle: (id: string) => void }) {
  return <div className="grid gap-2"><Label>{title}</Label><div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">{users.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Nessun utente disponibile</p> : users.map((user) => <label key={user.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted"><Checkbox checked={selected.includes(user.id)} onCheckedChange={() => onToggle(user.id)} /><span className="text-sm">{user.nome} <span className="text-muted-foreground">· {user.ruolo}</span></span></label>)}</div></div>
}
