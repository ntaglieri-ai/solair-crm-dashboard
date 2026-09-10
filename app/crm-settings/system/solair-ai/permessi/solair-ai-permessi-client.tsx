"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { RUOLO_COLOR_CLASS, type RuoloColore } from "@/lib/ruoli-data"
import { cn } from "@/lib/utils"

type Ruolo = { id: string; code: string | null; nome: string; colore: RuoloColore }

type PermessiRuolo = {
  ruoloId: string
  menu: boolean
  run: boolean
  revisioni: boolean
}

type ChiavePermesso = "menu" | "run" | "revisioni"

const PERMESSI: { chiave: ChiavePermesso; titolo: string; descrizione: string }[] = [
  {
    chiave: "menu",
    titolo: "Vede la voce di menu",
    descrizione: "SolairAI compare nella barra laterale e la pagina si apre.",
  },
  {
    chiave: "run",
    titolo: "Avvia aggiornamenti e creazioni",
    descrizione:
      "Puo' far leggere i documenti e, dopo la propria conferma, scrivere sul CRM. Restano validi i permessi del modulo: senza modifica sui Lead, SolairAI non modifica un lead.",
  },
  {
    chiave: "revisioni",
    titolo: "Vede la coda di revisione",
    descrizione:
      "Vede i campi gia' pieni per cui un documento propone un valore diverso, e li accetta o rifiuta.",
  },
]

export function SolairAiPermessiClient({
  ruoli,
  iniziali,
  canManage,
}: {
  ruoli: Ruolo[]
  iniziali: PermessiRuolo[]
  canManage: boolean
}) {
  const [righe, setRighe] = useState(iniziali)
  const [salvataggio, setSalvataggio] = useState(false)

  const modificate = JSON.stringify(righe) !== JSON.stringify(iniziali)

  function permessiDi(ruoloId: string): PermessiRuolo {
    return (
      righe.find((riga) => riga.ruoloId === ruoloId) ?? {
        ruoloId,
        menu: false,
        run: false,
        revisioni: false,
      }
    )
  }

  function commuta(ruoloId: string, chiave: ChiavePermesso, valore: boolean) {
    setRighe((precedenti) =>
      precedenti.map((riga) => {
        if (riga.ruoloId !== ruoloId) return riga
        const aggiornata = { ...riga, [chiave]: valore }
        // Togliere il menu toglie anche il resto: un ruolo che non vede la
        // pagina non puo' avviare niente, e lasciare le spunte accese
        // racconterebbe un permesso che non esiste.
        if (chiave === "menu" && !valore) {
          aggiornata.run = false
          aggiornata.revisioni = false
        }
        // E viceversa: dare un'azione senza la pagina sarebbe un permesso
        // inerte, perche' le route controllano prima l'accesso alla pagina.
        if (chiave !== "menu" && valore) aggiornata.menu = true
        return aggiornata
      }),
    )
  }

  async function salva() {
    setSalvataggio(true)
    try {
      const risposta = await fetch("/api/crm-settings/solair-ai/permessi", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permessi: righe }),
      })
      if (!risposta.ok) {
        const corpo = (await risposta.json().catch(() => null)) as { error?: string } | null
        toast.error(corpo?.error ?? "Salvataggio non riuscito.")
        return
      }
      toast.success("Permessi SolairAI salvati.")
    } catch {
      toast.error("Salvataggio non riuscito. Controlla la connessione.")
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Permessi SolairAI"
        description="Chi vede SolairAI, chi puo' far scrivere sul CRM e chi controlla la coda delle revisioni. Le stesse tre chiavi le legge anche la RLS del database: toglierle qui le chiude davvero, non solo a schermo."
        action={
          canManage ? (
            <Button type="button" onClick={salva} disabled={!modificate || salvataggio}>
              <Save className="size-4" />
              {salvataggio ? "Salvataggio..." : "Salva"}
            </Button>
          ) : null
        }
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Permesso</th>
              {ruoli.map((ruolo) => (
                <th key={ruolo.id} className="px-3 py-3 text-center">
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                      RUOLO_COLOR_CLASS[ruolo.colore],
                    )}
                  >
                    {ruolo.nome}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMESSI.map((permesso) => (
              <tr key={permesso.chiave} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-foreground">{permesso.titolo}</p>
                  <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                    {permesso.descrizione}
                  </p>
                </td>
                {ruoli.map((ruolo) => {
                  // SUPERADMIN passa comunque: il motore dei permessi gli da'
                  // accesso a tutto prima di guardare le righe salvate. La
                  // spunta resta accesa e bloccata invece di suggerire una
                  // revoca che non avrebbe effetto.
                  const superadmin = (ruolo.code ?? "").toUpperCase() === "SUPERADMIN"
                  const valore = superadmin || permessiDi(ruolo.id)[permesso.chiave]
                  return (
                    <td key={ruolo.id} className="px-3 py-3 text-center align-top">
                      <Checkbox
                        checked={valore}
                        disabled={!canManage || superadmin}
                        aria-label={`${permesso.titolo} — ${ruolo.nome}`}
                        onCheckedChange={(stato) =>
                          commuta(ruolo.id, permesso.chiave, stato === true)
                        }
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        SUPERADMIN ha accesso a tutto per definizione e non e&apos; configurabile da qui. Per gli
        altri ruoli, senza spunta la voce sparisce dal menu e le API rispondono 403 — non
        e&apos; solo la barra laterale a nasconderla.
      </p>
    </div>
  )
}
