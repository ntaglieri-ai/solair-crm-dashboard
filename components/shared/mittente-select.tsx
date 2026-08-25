"use client"

// Dropdown "Invia da", condiviso dal compose singolo e dall'invio di massa.
//
// Il menu esiste solo per i ruoli con ruoli.puo_scegliere_mittente: per tutti
// gli altri /api/email/mittenti risponde canChoose:false e qui non si rende
// nulla. Chi non sceglie spedisce comunque dalla propria riga is_default,
// risolta lato server all'invio — l'assenza del menu non e' un invio bloccato.
//
// Il valore selezionato non e' una garanzia di niente: le route di invio
// rivalidano l'id con resolveSender() (lib/email/sender-accounts.ts).

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type MittenteOption = {
  id: string
  nomeVisualizzato: string
  email: string
  condivisa: boolean
  isDefault: boolean
}

type MittentiResponse = {
  canChoose: boolean
  defaultAccountId: string | null
  accounts: MittenteOption[]
}

export type MittenteState = {
  canChoose: boolean
  accounts: MittenteOption[]
  /** `null` finche' non e' arrivata la risposta, o se non si puo' scegliere. */
  selectedId: string | null
  setSelectedId: (id: string) => void
}

/**
 * Carica le caselle disponibili quando `enabled` diventa vero (tipicamente
 * all'apertura del dialog di composizione) e preseleziona la is_default.
 */
export function useMittenti(enabled: boolean): MittenteState {
  const [state, setState] = useState<MittentiResponse>({
    canChoose: false,
    defaultAccountId: null,
    accounts: [],
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    fetch("/api/email/mittenti", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("mittenti"))))
      .then((data: MittentiResponse) => {
        if (cancelled) return
        setState(data)
        // Preselezione: la riga is_default dell'utente; se non ne ha una
        // (utente senza casella propria) si parte dalla prima disponibile.
        setSelectedId(data.defaultAccountId ?? data.accounts[0]?.id ?? null)
      })
      .catch(() => {
        // Un errore qui non deve impedire l'invio: si ricade sul mittente
        // deciso dal server, che e' lo stesso default.
        if (!cancelled) setState({ canChoose: false, defaultAccountId: null, accounts: [] })
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return {
    canChoose: state.canChoose,
    accounts: state.accounts,
    selectedId,
    setSelectedId,
  }
}

export function MittenteSelect({
  state,
  disabled,
}: {
  state: MittenteState
  disabled?: boolean
}) {
  if (!state.canChoose || state.accounts.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Invia da</Label>
      <Select
        value={state.selectedId ?? ""}
        onValueChange={(value) => state.setSelectedId(value as string)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {state.accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.nomeVisualizzato} &lt;{account.email}&gt;
                {account.condivisa ? " · condivisa" : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
