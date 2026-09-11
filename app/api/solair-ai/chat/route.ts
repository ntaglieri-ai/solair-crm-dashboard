import { NextResponse } from "next/server"

import { requireApiPage } from "@/lib/permissions/server"
import {
  leggiDocumenti,
  interpretaTurno,
  rispondiDaIndiceSolairAI,
} from "@/lib/solair-ai/claude"
import {
  MAX_FILE_PER_TURNO,
  accessoAI,
  fileDellaCartella,
  scaricaContenuti,
  soloNuovi,
} from "@/lib/solair-ai/nextcloud"
import { risolviCampoAI } from "@/lib/solair-ai/campi"
import {
  confermaSemplice,
  entitaDaSelezioneSemplice,
  nomeDaRispostaSemplice,
  richiestaLetturaDocumenti,
  rifiutoSemplice,
} from "@/lib/solair-ai/dialogo"
import { cercaIndiceSolairAI } from "@/lib/solair-ai/indice"
import type { SolairAiKnowledgeSnippet } from "@/lib/solair-ai/indice"
import { trovaRecord } from "@/lib/solair-ai/records"
import { leggiImpostazioneAI } from "@/lib/solair-ai/settings"
import {
  ENTITA_ARTICOLO,
  ENTITA_LABEL,
  STATO_INIZIALE,
  isEntitaAI,
} from "@/lib/solair-ai/tipi"
import type {
  MessaggioChat,
  RisposteChat,
  StatoConversazione,
} from "@/lib/solair-ai/tipi"

// La lettura dei documenti passa dalla Claude API: nessuna cache, e tempi
// che non stanno nei 15 secondi di default.
export const dynamic = "force-dynamic"
export const maxDuration = 300

type Payload = {
  messaggi?: { ruolo?: string; testo?: string }[]
  stato?: Partial<StatoConversazione>
}

function risposta(
  messaggio: string,
  stato: StatoConversazione,
  extra: Partial<RisposteChat> = {},
): NextResponse {
  return NextResponse.json({
    messaggio,
    stato,
    attendeConferma: false,
    ...extra,
  } satisfies RisposteChat)
}

function fileDaRisultatiIndice(risultati: SolairAiKnowledgeSnippet[]) {
  return risultati.map((risultato) => ({
    path: risultato.path,
    nome: risultato.path.split("/").pop() ?? risultato.path,
    dimensione: null,
    modificatoIl: null,
    fingerprint: "",
  }))
}

function statoDaPayload(grezzo: Partial<StatoConversazione> | undefined): StatoConversazione {
  if (!grezzo) return { ...STATO_INIZIALE }
  return {
    entita: isEntitaAI(grezzo.entita) ? grezzo.entita : null,
    nome: typeof grezzo.nome === "string" && grezzo.nome.trim() !== "" ? grezzo.nome.trim() : null,
    // La proposta torna indietro dal client e non e' fidata: /applica la
    // rivalida campo per campo contro il catalogo e rilegge il record prima
    // di scrivere. Qui serve solo a sapere che c'e' una domanda in sospeso.
    proposta: grezzo.proposta ?? null,
  }
}

export async function POST(request: Request) {
  const guard = await requireApiPage("solair_ai")
  if (guard.response) return guard.response

  const permissions = guard.permissions
  if (!permissions.canAction("solair_ai.run")) {
    return NextResponse.json(
      { error: "Non hai il permesso di avviare aggiornamenti con SolairAI." },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as Payload | null
  const messaggi: MessaggioChat[] = (body?.messaggi ?? [])
    .filter((voce) => typeof voce?.testo === "string" && voce.testo.trim() !== "")
    .map((voce, indice) => ({
      id: String(indice),
      ruolo: voce.ruolo === "bot" ? "bot" : "utente",
      testo: String(voce.testo).slice(0, 4000),
    }))

  if (messaggi.length === 0) {
    return NextResponse.json({ error: "Nessun messaggio da leggere." }, { status: 400 })
  }

  const stato = statoDaPayload(body?.stato)
  const ultimoMessaggio = messaggi[messaggi.length - 1]?.testo ?? ""

  if (stato.proposta && rifiutoSemplice(ultimoMessaggio)) {
    return risposta("Va bene, non tocco niente. Dimmi pure se serve altro.", {
      entita: stato.entita,
      nome: stato.nome,
      proposta: null,
    })
  }

  if (stato.proposta && confermaSemplice(ultimoMessaggio)) {
    return NextResponse.json({
      messaggio: "Procedo.",
      stato,
      attendeConferma: false,
      applica: true,
    })
  }

  const entitaSelezionata = entitaDaSelezioneSemplice(ultimoMessaggio)
  if (entitaSelezionata) {
    return risposta(
      `Ok, ${ENTITA_LABEL[entitaSelezionata].toLowerCase()}. ` +
        `Come si chiama ${ENTITA_ARTICOLO[entitaSelezionata]}?`,
      { entita: entitaSelezionata, nome: null, proposta: null },
    )
  }

  const letturaRapidaNome =
    stato.entita && !stato.nome ? nomeDaRispostaSemplice(ultimoMessaggio) : null
  if (stato.entita && letturaRapidaNome) {
    return risposta(
      `Ok, ${ENTITA_LABEL[stato.entita].toLowerCase()} "${letturaRapidaNome}". ` +
        "Che cosa vuoi sapere? Se vuoi leggere i documenti nuovi e preparare aggiornamenti CRM, scrivi \"leggi documenti\".",
      { entita: stato.entita, nome: letturaRapidaNome, proposta: null },
    )
  }

  const letturaLiveRichiesta = richiestaLetturaDocumenti(ultimoMessaggio)
  if (stato.entita && stato.nome && !stato.proposta && !letturaLiveRichiesta) {
    const risultati = await cercaIndiceSolairAI(`${stato.nome} ${ultimoMessaggio}`, {
      entita: stato.entita,
      limit: 8,
    })
    if (risultati.length > 0) {
      const messaggio = await rispondiDaIndiceSolairAI({
        domanda: `${ultimoMessaggio}\n\nContesto record: ${ENTITA_LABEL[stato.entita]} ${stato.nome}.`,
        risultati,
      })
      return risposta(
        messaggio,
        { entita: stato.entita, nome: stato.nome, proposta: null },
        { file: fileDaRisultatiIndice(risultati) },
      )
    }

    return risposta(
      "Non trovo ancora abbastanza nell'indice per rispondere su questo record. " +
        "Se vuoi controllare Nextcloud live e preparare aggiornamenti CRM, scrivi \"leggi documenti\".",
      { entita: stato.entita, nome: stato.nome, proposta: null },
    )
  }

  let lettura
  if (stato.entita && stato.nome && letturaLiveRichiesta) {
    lettura = {
      entita: stato.entita,
      nome: stato.nome,
      conferma: false,
      rifiuto: false,
      domanda: null,
    }
  } else {
    try {
      lettura = await interpretaTurno(
        messaggi.map((messaggio) => ({ ruolo: messaggio.ruolo, testo: messaggio.testo })),
        { entita: stato.entita, nome: stato.nome, attendeConferma: stato.proposta != null },
      )
    } catch (errore) {
      return NextResponse.json(
        { error: errore instanceof Error ? errore.message : "SolairAI non ha risposto." },
        { status: 502 },
      )
    }
  }

  // Rifiuto su una proposta in sospeso: si butta via e si torna in ascolto.
  // Nessuna scrittura, che e' il punto del "nessuna scrittura senza conferma".
  if (stato.proposta && lettura.rifiuto) {
    return risposta("Va bene, non tocco niente. Dimmi pure se serve altro.", {
      entita: stato.entita,
      nome: stato.nome,
      proposta: null,
    })
  }

  // Conferma su una proposta in sospeso: la applica /api/solair-ai/applica,
  // che il client chiama appena riceve questa risposta. Qui non si scrive
  // niente: la scrittura sta dietro un endpoint suo, con il suo permesso.
  if (stato.proposta && lettura.conferma) {
    return NextResponse.json({
      messaggio: "Procedo.",
      stato,
      attendeConferma: false,
      applica: true,
    })
  }

  const entita = lettura.entita
  if (!entita) {
    const risultati = await cercaIndiceSolairAI(ultimoMessaggio, { limit: 8 })
    if (risultati.length > 0) {
      const messaggio = await rispondiDaIndiceSolairAI({
        domanda: ultimoMessaggio,
        risultati,
      })
      return risposta(
        messaggio,
        { entita: null, nome: lettura.nome, proposta: null },
        { file: fileDaRisultatiIndice(risultati) },
      )
    }

    return risposta(
      lettura.domanda ??
        "Su che cosa stiamo lavorando: un lead, un cliente o un installatore?",
      { entita: null, nome: lettura.nome, proposta: null },
    )
  }

  const nome = lettura.nome
  if (!nome) {
    const risultati = await cercaIndiceSolairAI(ultimoMessaggio, { entita, limit: 8 })
    if (risultati.length > 0) {
      const messaggio = await rispondiDaIndiceSolairAI({
        domanda: ultimoMessaggio,
        risultati,
      })
      return risposta(
        messaggio,
        { entita, nome: null, proposta: null },
        { file: fileDaRisultatiIndice(risultati) },
      )
    }

    return risposta(
      lettura.domanda ?? `Come si chiama ${ENTITA_ARTICOLO[entita]}?`,
      { entita, nome: null, proposta: null },
    )
  }

  const impostazione = await leggiImpostazioneAI(entita)
  if (!impostazione.attivo) {
    return risposta(
      `La lettura documenti per ${ENTITA_LABEL[entita]} e' disattivata nelle impostazioni.`,
      { entita, nome, proposta: null },
    )
  }
  if (impostazione.nextcloudPath === "") {
    return risposta(
      `Non ho ancora una cartella da cui leggere per ${ENTITA_LABEL[entita]}. ` +
        "Va configurata in CRM Settings, AI Features, SolairAI.",
      { entita, nome, proposta: null },
    )
  }

  // Il record si cerca PRIMA dei file: serve a sapere se le letture gia'
  // fatte sono agganciate a un record o ancora senza, e quindi a fare il
  // confronto giusto nel registro.
  const record = await trovaRecord(entita, nome)

  let accesso
  try {
    accesso = await accessoAI(permissions.snapshot.subject)
  } catch (errore) {
    return risposta(
      errore instanceof Error
        ? errore.message
        : "Non riesco ad accedere a Nextcloud con il tuo account.",
      { entita, nome, proposta: null },
    )
  }

  let candidati
  try {
    candidati = await fileDellaCartella(accesso, impostazione.nextcloudPath, nome)
  } catch (errore) {
    return risposta(
      `Non riesco a leggere la cartella ${impostazione.nextcloudPath}: ` +
        (errore instanceof Error ? errore.message : "errore Nextcloud"),
      { entita, nome, proposta: null },
    )
  }

  if (candidati.length === 0) {
    return risposta(
      `In ${impostazione.nextcloudPath} non trovo file intestati a "${nome}". ` +
        "Controlla il nome della cartella o del file.",
      { entita, nome, proposta: null },
    )
  }

  const nuovi = await soloNuovi(entita, record?.id ?? null, candidati)
  if (nuovi.length === 0) {
    return risposta("Nessuna novita', ho gia' letto tutto quello che c'e'.", {
      entita,
      nome,
      proposta: null,
    })
  }

  const daLeggere = nuovi.slice(0, MAX_FILE_PER_TURNO)
  const rimasti = nuovi.length - daLeggere.length

  let estrazione
  try {
    const contenuti = await scaricaContenuti(accesso, daLeggere)
    estrazione = await leggiDocumenti({
      entita,
      nome,
      contenuti,
      valoriAttuali: record?.valori ?? null,
    })
  } catch (errore) {
    return risposta(
      errore instanceof Error ? errore.message : "Non sono riuscito a leggere i documenti.",
      { entita, nome, proposta: null },
    )
  }

  const campi = estrazione.campi
    .map((proposto) => {
      // Il modello risponde con l'etichetta che gli abbiamo mostrato: qui si
      // torna alla colonna reale. Un campo fuori catalogo sparisce subito,
      // cosi' non arriva nemmeno a schermo — la stessa whitelist la riapplica
      // /applica, che e' il punto in cui conta davvero.
      const campo = risolviCampoAI(entita, proposto.campo)
      if (!campo) return null
      return {
        campo: campo.column,
        etichetta: campo.etichetta,
        valore: proposto.valore,
        // La fonte la copia il modello dall'elenco dei file; se sbaglia a
        // copiarla la riga di revisione punterebbe a un file inesistente,
        // quindi si accetta solo un percorso fra quelli davvero letti.
        fonte: daLeggere.some((file) => file.path === proposto.fonte)
          ? proposto.fonte
          : (daLeggere[0]?.path ?? ""),
      }
    })
    .filter((campo) => campo !== null)

  const testa = [
    `Ho letto ${daLeggere.length} ${daLeggere.length === 1 ? "file nuovo" : "file nuovi"}.`,
    rimasti > 0 ? `(Ne restano ${rimasti}: te li leggo al prossimo giro.)` : null,
    "",
    estrazione.riepilogo,
  ]
    .filter((riga) => riga !== null)
    .join("\n")

  if (campi.length === 0) {
    return risposta(
      `${testa}\n\nNon ho trovato campi da valorizzare, quindi non ti chiedo niente.`,
      { entita, nome, proposta: null },
      { file: daLeggere },
    )
  }

  const domanda = record
    ? `Aggiorno il CRM su ${record.etichetta}?`
    : `Non trovo ${ENTITA_ARTICOLO[entita]} "${nome}" nel CRM. Creo ${ENTITA_ARTICOLO[entita]}?`

  return NextResponse.json({
    messaggio: `${testa}\n\n${domanda}`,
    attendeConferma: true,
    file: daLeggere,
    stato: {
      entita,
      nome,
      proposta: {
        entita,
        nome,
        recordId: record?.id ?? null,
        recordEtichetta: record?.etichetta ?? null,
        campi,
        file: daLeggere,
        riepilogo: estrazione.riepilogo,
      },
    },
  } satisfies RisposteChat)
}
