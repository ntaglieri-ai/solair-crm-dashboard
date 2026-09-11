"use client"

import { useState } from "react"
import { FolderTree, Save, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { NextcloudFolderPicker } from "@/components/nextcloud/nextcloud-folder-picker"
import { ENTITA_LABEL } from "@/lib/solair-ai/tipi"
import type { EntitaAI } from "@/lib/solair-ai/tipi"

type Impostazione = {
  entita: EntitaAI
  nextcloudPath: string
  attivo: boolean
  aggiornatoIl: string | null
}

const AIUTO: Record<EntitaAI, string> = {
  lead: "Dentro, una sottocartella per lead oppure file col nome nel titolo.",
  cliente: "La cartella con il materiale dei clienti.",
  installatore: "La cartella con il materiale degli installatori.",
}

export function SolairAiSettingsClient({
  impostazioni,
  canManage,
}: {
  impostazioni: Impostazione[]
  canManage: boolean
}) {
  const [righe, setRighe] = useState(impostazioni)
  const [salvataggio, setSalvataggio] = useState(false)

  const modificate =
    JSON.stringify(righe) !== JSON.stringify(impostazioni)

  function aggiorna(entita: EntitaAI, patch: Partial<Impostazione>) {
    setRighe((precedenti) =>
      precedenti.map((riga) => (riga.entita === entita ? { ...riga, ...patch } : riga)),
    )
  }

  async function salva() {
    setSalvataggio(true)
    try {
      const risposta = await fetch("/api/crm-settings/solair-ai", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          impostazioni: righe.map((riga) => ({
            entita: riga.entita,
            nextcloudPath: riga.nextcloudPath,
            attivo: riga.attivo,
          })),
        }),
      })
      const corpo = (await risposta.json().catch(() => null)) as
        | { impostazioni?: Impostazione[]; error?: string }
        | null

      if (!risposta.ok) {
        toast.error(corpo?.error ?? "Salvataggio non riuscito.")
        return
      }
      // Si riparte dai valori normalizzati dal server (path ripuliti), non da
      // quelli digitati: altrimenti il campo resterebbe a mostrare uno slash
      // finale che a database non e' stato scritto.
      if (corpo?.impostazioni) setRighe(corpo.impostazioni)
      toast.success("Configurazione SolairAI salvata.")
    } catch {
      toast.error("Salvataggio non riuscito. Controlla la connessione.")
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="SolairAI"
        description="Le cartelle Nextcloud da cui SolairAI legge i documenti, una per tipo di record. Si scelgono sfogliando l'albero reale: l'elenco e' quello che vede l'account con cui SolairAI apre Nextcloud."
        action={
          canManage ? (
            <Button type="button" onClick={salva} disabled={!modificate || salvataggio}>
              <Save className="size-4" />
              {salvataggio ? "Salvataggio..." : "Salva"}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        {righe.map((riga) => (
          <div
            key={riga.entita}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#6f42c1]/10 text-[#6f42c1]">
                  <Sparkles className="size-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {ENTITA_LABEL[riga.entita]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`attivo-${riga.entita}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Lettura attiva
                </Label>
                <Switch
                  id={`attivo-${riga.entita}`}
                  checked={riga.attivo}
                  disabled={!canManage}
                  onCheckedChange={(valore) =>
                    aggiorna(riga.entita, { attivo: valore === true })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Cartella Nextcloud
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <FolderTree className="size-4 shrink-0 text-muted-foreground" />
                  {riga.nextcloudPath ? (
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                      /{riga.nextcloudPath}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      Nessuna cartella scelta
                    </span>
                  )}
                  {canManage && riga.nextcloudPath ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Svuota la cartella di ${ENTITA_LABEL[riga.entita]}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => aggiorna(riga.entita, { nextcloudPath: "" })}
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <NextcloudFolderPicker
                  value={riga.nextcloudPath}
                  disabled={!canManage}
                  browseUrl="/api/crm-settings/solair-ai/browse"
                  triggerLabel={riga.nextcloudPath ? "Cambia" : "Scegli cartella"}
                  title={`Cartella di ${ENTITA_LABEL[riga.entita]}`}
                  description="Naviga le tue cartelle Nextcloud e scegli con un click quella da cui SolairAI deve leggere."
                  onSelect={(path) => aggiorna(riga.entita, { nextcloudPath: path })}
                />
              </div>
              <p className="text-xs text-muted-foreground">{AIUTO[riga.entita]}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        SolairAI apre Nextcloud con l&apos;account personale di chi sta chattando, quindi vede
        solo le cartelle che quella persona vedrebbe accedendo da sola. Una cartella
        configurata qui ma non condivisa con l&apos;utente risultera&apos; vuota, non negata.
      </p>
    </div>
  )
}
