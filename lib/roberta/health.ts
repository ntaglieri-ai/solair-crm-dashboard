export type RobertaDocumentStatus = "ready" | "scan_pending" | "empty" | "error"

export type RobertaHealthInput = {
  sources: number
  chunks: number
  catalogItems: number
  lastSync: {
    ok: boolean
    syncedAt: string
    error: string | null
  } | null
  recentSources: {
    nome: string
    cartella: string
    stato: RobertaDocumentStatus
    testo_chars: number
    synced_at: string
    errore: string | null
  }[]
}

export type RobertaHealthLevel = "green" | "yellow" | "red"

export type RobertaHealth = {
  level: RobertaHealthLevel
  label: string
  summary: string
  alarms: string[]
}

const STALE_SYNC_MS = 48 * 60 * 60 * 1000

export function deriveRobertaHealth(status: RobertaHealthInput | null | undefined): RobertaHealth {
  if (!status) {
    return {
      level: "yellow",
      label: "Controllo",
      summary: "Stato RobertaBot in lettura",
      alarms: ["Stato non ancora caricato"],
    }
  }

  const redAlarms: string[] = []
  const yellowAlarms: string[] = []

  if (status.sources === 0) redAlarms.push("Nessun documento indicizzato")
  if (status.chunks === 0) redAlarms.push("Nessun blocco conoscenza disponibile")

  const errorSources = status.recentSources.filter((source) => source.stato === "error")
  if (errorSources.length > 0) {
    redAlarms.push(
      `${errorSources.length} documento/i con errore di indicizzazione`,
    )
  }

  const pendingSources = status.recentSources.filter((source) => source.stato === "scan_pending")
  if (pendingSources.length > 0) {
    yellowAlarms.push(`${pendingSources.length} documento/i in attesa scansione`)
  }

  const emptySources = status.recentSources.filter((source) => source.stato === "empty")
  if (emptySources.length > 0) {
    yellowAlarms.push(`${emptySources.length} documento/i senza testo utile`)
  }

  if (status.catalogItems === 0 && status.chunks > 0) {
    yellowAlarms.push("Nessuna riga catalogo estratta")
  }

  if (status.lastSync?.ok === false) {
    redAlarms.push(
      status.lastSync.error
        ? `Ultima sincronizzazione fallita: ${status.lastSync.error}`
        : "Ultima sincronizzazione fallita",
    )
  }

  const lastSync = status.lastSync?.syncedAt
    ? new Date(status.lastSync.syncedAt).getTime()
    : status.recentSources
        .map((source) => new Date(source.synced_at).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0]

  if (!lastSync) {
    yellowAlarms.push("Nessun controllo automatico registrato")
  } else if (Date.now() - lastSync > STALE_SYNC_MS) {
    yellowAlarms.push("Ultima sincronizzazione oltre 48 ore fa")
  }

  if (redAlarms.length > 0) {
    return {
      level: "red",
      label: "Problema",
      summary: "RobertaBot richiede intervento",
      alarms: [...redAlarms, ...yellowAlarms],
    }
  }

  if (yellowAlarms.length > 0) {
    return {
      level: "yellow",
      label: "Attenzione",
      summary: "RobertaBot operativa con avvisi",
      alarms: yellowAlarms,
    }
  }

  return {
    level: "green",
    label: "Operativa",
    summary: "RobertaBot pronta",
    alarms: [],
  }
}
