"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { usePermissions } from "@/lib/permissions/provider"
import { cn } from "@/lib/utils"

// Interruttore globale del blocco invii senza consenso.
//
// Visibile solo a SUPERADMIN: il controllo qui e' cosmetico e serve a non
// mostrare un comando che darebbe 403: quello vero e' su
// app/api/crm-settings/consenso-enforcement/route.ts, che rifiuta chiunque
// altro anche in GET.
//
// A blocco spento la card diventa rossa e dichiarativa. E' voluto: uno stato
// che rimette in circolo email verso chi non ha acconsentito non deve poter
// passare inosservato in fondo a una pagina di impostazioni.

export function ConsensoEnforcementCard() {
  const permissions = usePermissions()
  const isSuperadmin = permissions.snapshot.subject.ruoloCode === "SUPERADMIN"

  const [attivo, setAttivo] = useState<boolean | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!isSuperadmin) return
    let annullato = false
    fetch("/api/crm-settings/consenso-enforcement", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { attivo?: boolean }) => {
        if (!annullato) setAttivo(Boolean(data.attivo))
      })
      .catch(() => {
        if (!annullato) setAttivo(null)
      })
    return () => {
      annullato = true
    }
  }, [isSuperadmin])

  if (!isSuperadmin) return null

  async function handleChange(nuovo: boolean) {
    const precedente = attivo
    setAttivo(nuovo)
    setSalvando(true)
    try {
      const res = await fetch("/api/crm-settings/consenso-enforcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attivo: nuovo }),
      })
      if (!res.ok) throw new Error("Salvataggio non riuscito")
      if (nuovo) {
        toast.success("Blocco consenso riattivato", {
          description: "Le email tornano a partire solo verso chi ha acconsentito.",
        })
      } else {
        toast.warning("Blocco consenso disattivato", {
          description:
            "Da ora le email partono senza filtro. Ogni invio verra' registrato nell'audit log.",
        })
      }
    } catch {
      setAttivo(precedente)
      toast.error("Errore nel salvataggio dell'interruttore")
    } finally {
      setSalvando(false)
    }
  }

  const spento = attivo === false

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3.5",
        spento
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {spento ? (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          ) : (
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal" />
          )}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Blocco invii senza consenso
            </span>
            <span className="text-[13px] text-muted-foreground">
              Impedisce l&apos;invio di email verso lead e clienti che non hanno dato
              il consenso al contatto. Solo SUPERADMIN puo&apos; modificarlo.
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {salvando ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          <Switch
            checked={attivo === true}
            disabled={attivo === null || salvando}
            onCheckedChange={handleChange}
            aria-label="Blocco invii senza consenso"
          />
        </div>
      </div>

      {spento ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
          Blocco consenso disattivato — invii senza filtro attivi. Ogni email
          inviata a un contatto senza consenso viene registrata nell&apos;audit log.
        </p>
      ) : null}

      {attivo === null ? (
        <p className="text-[12px] text-muted-foreground">Stato non disponibile.</p>
      ) : null}
    </div>
  )
}
