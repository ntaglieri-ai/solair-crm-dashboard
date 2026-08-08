"use client"

// Selettore "Installatore assegnato" con suggerimento automatico per zona
// (spec FASE 3, punto 3.3): i compatibili con la provincia del cliente sono
// raggruppati in testa, le coperture a raggio non valutabili (PM Technology
// senza coordinate cliente) escono come "da verificare", tutti gli altri
// restano comunque selezionabili — il suggerimento non blocca mai la scelta.
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Suggerito = { id: string; nome: string; motivo: string }

type SuggeritiResponse = {
  provincia: string
  regione: string | null
  suggeriti: Suggerito[]
  daVerificare: Suggerito[]
  altri: { id: string; nome: string }[]
}

export function InstallatoreAssegnatoSelect({
  clienteId,
  provincia,
  installatoreAttuale,
}: {
  clienteId: string
  provincia?: string
  installatoreAttuale?: string
}) {
  const [dati, setDati] = useState<SuggeritiResponse | null>(null)
  const [erroreCaricamento, setErroreCaricamento] = useState(false)
  const [value, setValue] = useState<string | null>(installatoreAttuale ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (provincia) params.set("provincia", provincia)
    fetch(`/api/installatori/suggeriti?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: SuggeritiResponse) => {
        if (!cancelled) setDati(json)
      })
      .catch(() => {
        if (!cancelled) setErroreCaricamento(true)
      })
    return () => {
      cancelled = true
    }
  }, [provincia])

  // Il valore salvato a DB e' il nome (clienti.installatore, testo da Zoho):
  // il Select usa il nome come value, cosi' anche un assegnato storico che non
  // esiste piu' in anagrafica resta visibile e riselezionabile.
  const { items, idPerNome, assegnatoFuoriLista } = useMemo(() => {
    const idPerNome = new Map<string, string>()
    for (const gruppo of [dati?.suggeriti, dati?.daVerificare, dati?.altri]) {
      for (const i of gruppo ?? []) idPerNome.set(i.nome, i.id)
    }
    const items: Record<string, string> = {}
    for (const nome of idPerNome.keys()) items[nome] = nome
    const assegnatoFuoriLista = Boolean(
      installatoreAttuale && !idPerNome.has(installatoreAttuale),
    )
    if (installatoreAttuale && assegnatoFuoriLista) {
      items[installatoreAttuale] = installatoreAttuale
    }
    return { items, idPerNome, assegnatoFuoriLista }
  }, [dati, installatoreAttuale])

  async function handleChange(nome: string | null) {
    if (!nome || nome === value) return
    const prev = value
    setValue(nome)
    setSaving(true)
    try {
      const res = await fetch(`/api/clienti/${clienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Installatore: nome,
          InstallatoreId: idPerNome.get(nome) ?? null,
        }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      toast.success("Installatore assegnato", { description: nome })
    } catch {
      setValue(prev)
      toast.error("Errore nell'assegnazione dell'installatore")
    } finally {
      setSaving(false)
    }
  }

  // Caricamento fallito: si torna alla sola lettura invece di offrire un
  // selettore vuoto.
  if (erroreCaricamento) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Installatore assegnato
        </span>
        <span className="text-[13px] text-foreground">{value ?? "—"}</span>
      </div>
    )
  }

  const motivoSelezionato =
    value != null
      ? [...(dati?.suggeriti ?? []), ...(dati?.daVerificare ?? [])].find(
          (s) => s.nome === value,
        )?.motivo ?? null
      : null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Installatore assegnato
      </span>
      <Select
        items={items}
        value={value}
        onValueChange={handleChange}
        disabled={saving || !dati}
      >
        <SelectTrigger className="h-8 w-full max-w-[340px] bg-card text-[13px]">
          <SelectValue placeholder={dati ? "Seleziona installatore" : "Caricamento…"} />
        </SelectTrigger>
        <SelectContent>
          {dati && dati.suggeriti.length > 0 ? (
            <SelectGroup>
              <SelectLabel>
                {dati.regione
                  ? `Suggeriti — ${dati.regione} (${dati.provincia})`
                  : "Suggeriti"}
              </SelectLabel>
              {dati.suggeriti.map((s) => (
                <SelectItem key={s.id} value={s.nome}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {dati && dati.daVerificare.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Da verificare — copertura a raggio</SelectLabel>
              {dati.daVerificare.map((s) => (
                <SelectItem key={s.id} value={s.nome}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {dati && dati.altri.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Altri installatori</SelectLabel>
              {dati.altri.map((i) => (
                <SelectItem key={i.id} value={i.nome}>
                  {i.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {assegnatoFuoriLista && installatoreAttuale ? (
            <SelectGroup>
              <SelectLabel>Assegnato (non in anagrafica)</SelectLabel>
              <SelectItem value={installatoreAttuale}>{installatoreAttuale}</SelectItem>
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
      {motivoSelezionato ? (
        <span className="text-[11px] text-muted-foreground">{motivoSelezionato}</span>
      ) : null}
      {dati && !provincia ? (
        <span className="text-[11px] text-muted-foreground">
          Provincia indirizzo postale non impostata: nessun suggerimento territoriale.
        </span>
      ) : null}
      {dati && provincia && !dati.regione ? (
        <span className="text-[11px] text-muted-foreground">
          Provincia “{provincia}” non riconosciuta: nessun suggerimento territoriale.
        </span>
      ) : null}
    </div>
  )
}
