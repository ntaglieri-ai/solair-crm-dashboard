"use client"

import { useState } from "react"
import { Cable, MoreHorizontal, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"

type MakeConnection = {
  id: string
  name: string
  channel: "website" | "meta_ads" | "custom"
  webhookUrl: string
  active: boolean
  lastEventAt: string | null
}

const CHANNEL_LABEL: Record<MakeConnection["channel"], string> = {
  website: "Sito web",
  meta_ads: "Meta Ads",
  custom: "Personalizzata",
}

export default function MakePage() {
  const [connections, setConnections, store] =
    usePersistentSystemSetting<MakeConnection[]>("company.integrations.make", [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MakeConnection | null>(null)
  const [name, setName] = useState("")
  const [channel, setChannel] =
    useState<MakeConnection["channel"]>("website")
  const [webhookUrl, setWebhookUrl] = useState("")

  function openForm(connection?: MakeConnection) {
    setEditing(connection ?? null)
    setName(connection?.name ?? "")
    setChannel(connection?.channel ?? "website")
    setWebhookUrl(connection?.webhookUrl ?? "")
    setOpen(true)
  }

  function save() {
    if (!name.trim() || !webhookUrl.trim()) return
    try {
      new URL(webhookUrl)
    } catch {
      toast.error("Inserisci un URL webhook valido")
      return
    }
    const next: MakeConnection = {
      id: editing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      channel,
      webhookUrl: webhookUrl.trim(),
      active: editing?.active ?? false,
      lastEventAt: editing?.lastEventAt ?? null,
    }
    setConnections((current) =>
      editing
        ? current.map((item) => (item.id === editing.id ? next : item))
        : [...current, next],
    )
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Integrazioni Make"
        description="Connessioni del CRM con sito, Meta Ads e scenari Make."
        action={
          <Button onClick={() => openForm()}>
            <Plus />
            Nuova connessione
          </Button>
        }
      />
      {store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {store.error}
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {!store.loading && connections.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <Cable className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-medium">Nessuna connessione configurata</p>
          </div>
        ) : null}
        {connections.map((connection) => (
          <article
            key={connection.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{connection.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CHANNEL_LABEL[connection.channel]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  checked={connection.active}
                  onCheckedChange={(active) =>
                    setConnections((current) =>
                      current.map((item) =>
                        item.id === connection.id ? { ...item, active } : item,
                      ),
                    )
                  }
                  aria-label={`Connessione ${connection.name} attiva`}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        aria-label={`Azioni ${connection.name}`}
                      >
                        <MoreHorizontal />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openForm(connection)}>
                      <Pencil />
                      Modifica
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        setConnections((current) =>
                          current.filter((item) => item.id !== connection.id),
                        )
                      }
                    >
                      <Trash2 />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="rounded-md bg-muted px-3 py-2">
              <code className="block truncate text-xs text-muted-foreground">
                {connection.webhookUrl}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Ultimo evento:{" "}
              {connection.lastEventAt
                ? new Date(connection.lastEventAt).toLocaleString("it-IT")
                : "nessun evento registrato"}
            </p>
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica connessione" : "Nuova connessione"}
            </DialogTitle>
            <DialogDescription>
              Configura il punto di ingresso Make usato dal CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="make-name">Nome</Label>
              <Input id="make-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Canale</Label>
              <Select value={channel} onValueChange={(value) => setChannel((value ?? "website") as MakeConnection["channel"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Sito web</SelectItem>
                  <SelectItem value="meta_ads">Meta Ads</SelectItem>
                  <SelectItem value="custom">Personalizzata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="make-url">Webhook URL</Label>
              <Input id="make-url" type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save}><Save />Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
