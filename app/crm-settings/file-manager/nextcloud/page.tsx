"use client"

import { useEffect, useState } from "react"
import { Cloud, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"

type NextcloudSettings = {
  url: string
  serviceUsername: string
}

export default function NextcloudPage() {
  const [stored, setStored, store] =
    usePersistentSystemSetting<NextcloudSettings>("maintenance.nextcloud", {
      url: "",
      serviceUsername: "",
    })
  const [settings, setSettings] = useState(stored)

  useEffect(() => {
    queueMicrotask(() => setSettings(stored))
  }, [stored])

  function update(key: keyof NextcloudSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function save() {
    setStored(settings)
    toast.success("Configurazione salvata")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="File Manager"
        description="Configurazione dell'istanza Nextcloud usata dal CRM."
      />
      {store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {store.error}
        </p>
      ) : null}
      <section className="flex max-w-3xl flex-col gap-5 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <Cloud />
          </span>
          <div>
            <h2 className="font-semibold">Connessione Nextcloud</h2>
            <p className="text-sm text-muted-foreground">
              Le credenziali sensibili restano nelle variabili server.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nextcloud-url">URL istanza</Label>
          <Input
            id="nextcloud-url"
            type="url"
            value={settings.url}
            onChange={(event) => update("url", event.target.value)}
            placeholder="https://cloud.example.it"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nextcloud-user">Account di servizio</Label>
          <Input
            id="nextcloud-user"
            value={settings.serviceUsername}
            onChange={(event) => update("serviceUsername", event.target.value)}
          />
        </div>
        <div>
          <Button
            onClick={save}
            disabled={store.saving}
          >
            {store.saving ? <Loader2 className="animate-spin" /> : <Save />}
            Salva
          </Button>
        </div>
      </section>
    </div>
  )
}
