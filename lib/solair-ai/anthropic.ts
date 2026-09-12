import "server-only"

/**
 * Unico punto di uscita verso la Messages API per SolairAI.
 *
 * Nasce con il backfill: finche' i file si leggevano uno alla volta, una
 * fetch nuda bastava. In parallelo no — un 429 su un worker, senza nessuno
 * che lo racconti agli altri, diventa 40 richieste che continuano a
 * sbattere sullo stesso muro. Qui il 429 mette in pausa TUTTI i chiamanti
 * (`pausaFinoA` e' di modulo), e la finestra la detta l'header `retry-after`
 * quando c'e'.
 *
 * Limiti reali dell'account (letti dagli header il 11/09/2026):
 * 10.000 richieste/min, 10M token input/min, 2M output/min. Con una decina
 * di richieste in volo non si sfiora nessuno dei tre: il tetto vero del
 * backfill sono i token di input al minuto, non le richieste.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages"

/** Oltre questi tentativi si arrende e l'errore risale al chiamante. */
const MAX_TENTATIVI = 5

/** Una richiesta appesa non deve mangiarsi il budget della funzione. */
const TIMEOUT_MS = 120_000

const ATTESA_MAX_MS = 30_000

/** Stati che vale la pena riprovare: sovraccarico, non errore di richiesta. */
const RIPROVABILI = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])

/**
 * Finestra di pausa condivisa da tutti i worker del processo. La scrive chi
 * incassa un 429, la rispettano tutti prima di partire.
 */
let pausaFinoA = 0

/** Quando si e' visto l'ultimo guasto di account (0 = mai). */
let ultimoGuastoDiAccount = 0

/**
 * Il guasto di account si riconosce dallo STATO HTTP, non dal testo.
 * Il testo cambia — "invalid x-api-key", "API key is invalid", "Your credit
 * balance is too low" — e un elenco di frasi da confrontare e' una difesa
 * che scade da sola: la prima versione di questo controllo cercava
 * "invalid x-api-key" e si e' fatta sfuggire "API key is invalid",
 * bruciando undici file in un colpo.
 */
function segnalaSeGuastoDiAccount(status: number, corpo: unknown) {
  const messaggio =
    typeof corpo === "object" && corpo != null && "error" in corpo
      ? String((corpo as { error?: { message?: unknown } }).error?.message ?? "")
      : ""
  const perCredito = /credit balance|billing|quota/i.test(messaggio)
  if (status === 401 || status === 403 || perCredito) {
    ultimoGuastoDiAccount = Date.now()
  }
}

/**
 * Vero se di recente l'API ha risposto "account fermo". I worker lo guardano
 * prima di marcare un file come non indicizzabile: in quel caso il file e'
 * sano e va rimesso in coda, non consumato.
 */
export function guastoDiAccountRecente(entroMs = 60_000): boolean {
  return ultimoGuastoDiAccount > 0 && Date.now() - ultimoGuastoDiAccount < entroMs
}

function dormi(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}

async function rispettaLaPausa() {
  const attesa = pausaFinoA - Date.now()
  if (attesa > 0) await dormi(attesa)
}

/** `retry-after` in secondi; alcune risposte lo danno come data HTTP. */
function attesaDaHeader(risposta: Response): number | null {
  const grezzo = risposta.headers.get("retry-after")
  if (!grezzo) return null
  const secondi = Number(grezzo)
  if (Number.isFinite(secondi)) return secondi * 1000
  const data = Date.parse(grezzo)
  return Number.isFinite(data) ? data - Date.now() : null
}

/** Esponenziale con jitter: senza jitter 12 worker ripartono tutti insieme. */
function attesaDiBackoff(tentativo: number): number {
  const base = Math.min(ATTESA_MAX_MS, 1000 * 2 ** tentativo)
  return base / 2 + Math.random() * (base / 2)
}

export type EsitoClaude = { ok: boolean; status: number; corpo: unknown }

export async function richiediMessaggioClaude(params: {
  apiKey: string
  corpo: Record<string, unknown>
  /** Compare nei log e nei messaggi d'errore: serve a sapere CHI ha fallito. */
  etichetta: string
}): Promise<EsitoClaude> {
  let ultimoErrore: string | null = null

  for (let tentativo = 0; tentativo < MAX_TENTATIVI; tentativo++) {
    await rispettaLaPausa()

    let risposta: Response
    try {
      risposta = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(params.corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (errore) {
      // Rete caduta o timeout: e' esattamente il caso che prima lasciava
      // morire il file senza un secondo tentativo.
      ultimoErrore = errore instanceof Error ? errore.message : "errore di rete"
      if (tentativo === MAX_TENTATIVI - 1) break
      await dormi(attesaDiBackoff(tentativo))
      continue
    }

    if (risposta.ok || !RIPROVABILI.has(risposta.status)) {
      const corpo = await risposta.json().catch(() => null)
      if (!risposta.ok) segnalaSeGuastoDiAccount(risposta.status, corpo)
      return { ok: risposta.ok, status: risposta.status, corpo }
    }

    const attesa = attesaDaHeader(risposta) ?? attesaDiBackoff(tentativo)
    if (risposta.status === 429 || risposta.status === 529) {
      // Il muro e' dell'account, non della singola richiesta: ferma tutti.
      pausaFinoA = Math.max(pausaFinoA, Date.now() + Math.min(attesa, ATTESA_MAX_MS))
      console.warn(
        `[solair-ai/anthropic] ${params.etichetta}: HTTP ${risposta.status}, pausa ${Math.round(attesa)}ms`,
      )
    }

    const corpo = await risposta.json().catch(() => null)
    ultimoErrore = `HTTP ${risposta.status}`
    if (tentativo === MAX_TENTATIVI - 1) {
      return { ok: false, status: risposta.status, corpo }
    }
    await dormi(Math.min(attesa, ATTESA_MAX_MS))
  }

  throw new Error(`${params.etichetta}: ${ultimoErrore ?? "nessuna risposta"} dopo ${MAX_TENTATIVI} tentativi`)
}

/**
 * Guasti che non appartengono al file ma all'account: credito esaurito,
 * chiave revocata, permessi. Riprovarli e' inutile e marcare il file come
 * "non indicizzabile" e' una bugia — quando il credito e' tornato quel file
 * va benissimo. Chi li incontra deve fermare il giro e rimettere il file in
 * coda, non consumarlo.
 */
export function eGuastoDiAccount(messaggio: string | null | undefined): boolean {
  // Lo stato HTTP resta la prova principale (guastoDiAccountRecente): questo
  // e' solo un aiuto per i messaggi che attraversano piu' strati.
  if (!messaggio) return false
  const testo = messaggio.toLowerCase()
  return (
    testo.includes("credit balance") ||
    testo.includes("billing") ||
    testo.includes("authentication_error") ||
    testo.includes("invalid x-api-key") ||
    testo.includes("permission_error") ||
    testo.includes("http 401") ||
    testo.includes("http 403")
  )
}
