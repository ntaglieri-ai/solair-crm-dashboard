"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { CheckCircle, Loader2, Pencil } from "lucide-react"
import { NEXTCLOUD_CONFIG } from "@/lib/file-manager-data"

export default function NextcloudPage() {
  const [url, setUrl] = useState(NEXTCLOUD_CONFIG.url)
  const [editingUrl, setEditingUrl] = useState(false)
  const [testing, setTesting] = useState(false)
  const [lastTest, setLastTest] = useState(NEXTCLOUD_CONFIG.ultimoTest)

  function handleTest() {
    setTesting(true)
    window.setTimeout(() => {
      setTesting(false)
      setLastTest("Adesso")
    }, 1400)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Configurazione Nextcloud"
        description="Configura la connessione all'istanza Nextcloud usata come storage documenti del CRM."
      />

      {/* Card connessione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connessione</CardTitle>
          <CardDescription>
            Istanza Nextcloud collegata al CRM per la gestione dei documenti.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nc-url">URL istanza</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="nc-url"
                value={url}
                readOnly={!editingUrl}
                onChange={(e) => setUrl(e.target.value)}
                className={!editingUrl ? "bg-muted/50" : undefined}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUrl((v) => !v)}
                className="shrink-0"
              >
                <Pencil className="size-4" />
                {editingUrl ? "Fatto" : "Modifica"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Stato connessione
              </span>
              {testing ? (
                <Badge className="gap-1 bg-muted text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Verifica…
                </Badge>
              ) : (
                <Badge className="gap-1 bg-success text-success-foreground">
                  <CheckCircle className="size-3" />
                  Connesso
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ultimo test</span>
              <span className="text-sm font-medium text-foreground">
                {lastTest}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="border-teal text-teal hover:bg-teal/10"
            >
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle className="size-4" />
              )}
              Testa connessione
            </Button>
            <Button type="button" className="bg-teal text-teal-foreground hover:bg-teal/90">
              Salva
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card service account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account di servizio</CardTitle>
          <CardDescription>
            Account Nextcloud usato dal CRM per operazioni automatiche (lettura
            lista file, verifica cartelle).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nc-user">Username</Label>
            <Input
              id="nc-user"
              value={NEXTCLOUD_CONFIG.serviceUsername}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Stato</span>
            <Badge className="bg-success text-success-foreground">Attivo</Badge>
          </div>
          <div>
            <Button type="button" variant="outline">
              Modifica credenziali
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
