"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"

// Toggle del consenso al contatto via email, condiviso da scheda Lead e
// scheda Cliente.
//
// Esiste per registrare il dato quando viene raccolto: non blocca gli invii.
//
// Il salvataggio e' immediato e ottimistico, con rollback in caso di errore:
// stesso comportamento degli altri toggle della scheda.

export function ConsensoEmailToggle({
  recordId,
  endpoint,
  iniziale,
}: {
  recordId: string
  /** Base della route PATCH: "/api/leads" oppure "/api/clienti". */
  endpoint: "/api/leads" | "/api/clienti"
  iniziale: boolean
}) {
  const [valore, setValore] = useState(iniziale)
  const [salvando, setSalvando] = useState(false)

  async function handleChange(nuovo: boolean) {
    const precedente = valore
    setValore(nuovo)
    setSalvando(true)
    try {
      const res = await fetch(`${endpoint}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "Consenso e-mail": nuovo }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      toast.success(
        nuovo ? "Consenso e-mail registrato" : "Consenso e-mail revocato",
        {
          description: nuovo
            ? "Il dato e' stato salvato sulla scheda del contatto."
            : "Il dato e' stato aggiornato sulla scheda del contatto.",
        },
      )
    } catch {
      setValore(precedente)
      toast.error("Errore nel salvataggio del consenso")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <Switch
        checked={valore}
        onCheckedChange={handleChange}
        disabled={salvando}
        aria-label="Consenso al contatto via email"
      />
      <span className="text-[11px] text-muted-foreground">
        {valore
          ? "E-mail: consenso registrato"
          : "E-mail: consenso non registrato"}
      </span>
    </div>
  )
}
