import "server-only"

import { richiediMessaggioClaude } from "./anthropic"
import { CAMPI_AI } from "./campi"
import type { ContenutoFile } from "./nextcloud"
import type { SolairAiKnowledgeSnippet } from "./indice"
import { ENTITA_AI, ENTITA_LABEL, isEntitaAI } from "./tipi"
import type { EntitaAI } from "./tipi"

/**
 * Le due chiamate a Claude di SolairAI.
 *
 * Si parla con l'API via fetch e non con l'SDK ufficiale perche' e' la
 * convenzione gia' in casa: lib/roberta/knowledge.ts fa esattamente cosi'
 * per lo stesso lavoro (leggere documenti Nextcloud), e aggiungere
 * @anthropic-ai/sdk per un secondo chiamante significherebbe due modi di
 * fare la stessa cosa nello stesso repository.
 *
 * Il modello risponde chiamando un tool con `strict: true`: gli argomenti
 * arrivano gia' validi contro lo schema, senza doverli ripulire a mano. Il
 * tool_choice resta "auto" (piu' un'istruzione esplicita) invece di forzato,
 * perche' il forzato non convive con il thinking, che su Opus 5 e' acceso
 * di default ed e' quello che regge l'estrazione da documenti disordinati.
 */

const MODELLO_DEFAULT = "claude-opus-5"

function modello(): string {
  return process.env.SOLAIR_AI_MODEL?.trim() || MODELLO_DEFAULT
}

function apiKey(): string {
  const chiave = process.env.SOLAIR_AI_API_KEY
  if (!chiave) {
    throw new Error(
      "SolairAI non e' configurato: manca SOLAIR_AI_API_KEY fra le variabili d'ambiente.",
    )
  }
  return chiave
}

type BloccoTestuale = { type: "text"; text: string }
type BloccoContenuto =
  | BloccoTestuale
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | {
      type: "document"
      title?: string
      source: { type: "base64"; media_type: string; data: string }
    }

type ToolClaude = {
  name: string
  description: string
  strict: true
  input_schema: Record<string, unknown>
}

type RispostaClaude = {
  content?: { type?: string; name?: string; input?: unknown; text?: string }[]
  stop_reason?: string
  error?: { message?: string }
}

async function chiamaClaude(params: {
  system: string
  messaggi: { role: "user" | "assistant"; content: string | BloccoContenuto[] }[]
  tool: ToolClaude
  maxTokens: number
}): Promise<Record<string, unknown>> {
  const esito = await richiediMessaggioClaude({
    apiKey: apiKey(),
    etichetta: params.tool.name,
    corpo: {
      model: modello(),
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messaggi,
      tools: [params.tool],
      tool_choice: { type: "auto" },
    },
  })

  const corpo = esito.corpo as RispostaClaude | null
  if (!esito.ok) {
    throw new Error(
      `Claude non ha risposto (${corpo?.error?.message ?? `HTTP ${esito.status}`}).`,
    )
  }

  // Le classificazioni di sicurezza fermano il turno con HTTP 200: va letto
  // stop_reason prima del contenuto, altrimenti si scambia un rifiuto per
  // una risposta vuota.
  if (corpo?.stop_reason === "refusal") {
    throw new Error("Claude ha rifiutato di elaborare questi documenti.")
  }

  const chiamata = corpo?.content?.find(
    (blocco) => blocco.type === "tool_use" && blocco.name === params.tool.name,
  )
  if (chiamata && typeof chiamata.input === "object" && chiamata.input != null) {
    return chiamata.input as Record<string, unknown>
  }

  // Nessun tool_use: il modello ha risposto a parole. Non e' un errore da
  // mostrare all'utente come tale — il testo e' comunque una risposta.
  const testo = corpo?.content
    ?.filter((blocco) => blocco.type === "text")
    .map((blocco) => blocco.text ?? "")
    .join("\n")
    .trim()
  if (testo) return { __testo: testo }

  throw new Error("Claude ha risposto senza contenuto utilizzabile.")
}

function stringa(valore: unknown): string | null {
  return typeof valore === "string" && valore.trim() !== "" ? valore.trim() : null
}

// ---------------------------------------------------------------------------
// 1. Interpretazione del turno
// ---------------------------------------------------------------------------

export type LetturaTurno = {
  entita: EntitaAI | null
  nome: string | null
  /** L'ultimo messaggio dell'utente e' un si' sulla domanda aperta. */
  conferma: boolean
  /** L'ultimo messaggio dell'utente e' un no. */
  rifiuto: boolean
  /** Cosa chiedere quando manca qualcosa; null quando non manca niente. */
  domanda: string | null
}

const TOOL_INTERPRETA: ToolClaude = {
  name: "registra_lettura",
  description:
    "Registra cosa hai capito dall'ultimo messaggio dell'utente: su quale tipo di record sta " +
    "lavorando, di chi si tratta, e se sta confermando o rifiutando la domanda che gli hai fatto.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    // `entita` non e' fra i required: e' il modo giusto di dire "facoltativo"
    // a uno schema con enum. L'alternativa — tenerlo required e ammettere il
    // null nel tipo — l'API la rifiuta a monte, senza mai arrivare al
    // modello: "Invalid schema: Enum value 'lead' does not match declared
    // type '['string', 'null']'". Un enum non convive con un tipo unione.
    // Gli altri due facoltativi (nome, domanda) restano `["string", "null"]`
    // perche' non hanno enum: li' l'unione l'API la accetta.
    required: ["nome", "conferma", "rifiuto", "domanda"],
    properties: {
      entita: {
        type: "string",
        enum: [...ENTITA_AI],
        description:
          "Tipo di record. Ometti del tutto il campo se dalla conversazione non si capisce ancora.",
      },
      nome: {
        type: ["string", "null"],
        description:
          "Nome e cognome della persona (o ragione sociale) di cui si parla, come lo ha scritto " +
          "l'utente. null se non lo ha ancora detto.",
      },
      conferma: {
        type: "boolean",
        description:
          "true SOLO se l'ultimo messaggio dell'utente e' un assenso alla domanda in sospeso " +
          "(si, ok, procedi, aggiorna, crea pure).",
      },
      rifiuto: {
        type: "boolean",
        description: "true SOLO se l'ultimo messaggio e' un rifiuto esplicito (no, lascia stare, annulla).",
      },
      domanda: {
        type: ["string", "null"],
        description:
          "La domanda da fare all'utente quando manca il tipo di record o il nome. In italiano, " +
          "una frase breve e naturale. null se non manca niente.",
      },
    },
  },
}

const SYSTEM_INTERPRETA = `Sei SolairAI, l'assistente del CRM Solair. Parli italiano.

Il tuo lavoro: capire su quale record il collega sta lavorando, per poi andare a leggere i
documenti che ha caricato su Nextcloud.

Ti servono due informazioni: il TIPO di record (lead, cliente o installatore) e il NOME della
persona. Se ne manca una, chiedila con una frase breve e naturale — una domanda per volta,
partendo dal tipo. Non chiedere mai un'informazione che l'utente ha gia' dato in un messaggio
precedente della conversazione.

Non inventare nomi e non dedurli: se l'utente non ha detto di chi si tratta, il nome e' null.

Registra sempre il risultato chiamando il tool registra_lettura.`

export async function interpretaTurno(
  messaggi: { ruolo: "utente" | "bot"; testo: string }[],
  statoNoto: { entita: EntitaAI | null; nome: string | null; attendeConferma: boolean },
): Promise<LetturaTurno> {
  const contesto = [
    statoNoto.entita ? `Tipo di record gia' noto: ${ENTITA_LABEL[statoNoto.entita]}.` : null,
    statoNoto.nome ? `Nome gia' noto: ${statoNoto.nome}.` : null,
    statoNoto.attendeConferma
      ? "C'e' una domanda in sospeso: stai aspettando che l'utente confermi o rifiuti."
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  const input = await chiamaClaude({
    system: contesto ? `${SYSTEM_INTERPRETA}\n\nStato corrente: ${contesto}` : SYSTEM_INTERPRETA,
    messaggi: [
      {
        role: "user",
        content:
          "Conversazione finora:\n\n" +
          messaggi
            .map((messaggio) => `${messaggio.ruolo === "utente" ? "Utente" : "Tu"}: ${messaggio.testo}`)
            .join("\n"),
      },
    ],
    tool: TOOL_INTERPRETA,
    maxTokens: 2000,
  })

  const entita = input.entita
  return {
    entita: isEntitaAI(entita) ? entita : statoNoto.entita,
    nome: stringa(input.nome) ?? statoNoto.nome,
    conferma: input.conferma === true,
    rifiuto: input.rifiuto === true,
    domanda: stringa(input.domanda) ?? stringa(input.__testo),
  }
}

// ---------------------------------------------------------------------------
// 2. Lettura dei documenti
// ---------------------------------------------------------------------------

export type EstrazioneDocumenti = {
  riepilogo: string
  campi: { campo: string; valore: string; fonte: string }[]
}

const TOOL_ESTRAI: ToolClaude = {
  name: "registra_estrazione",
  description:
    "Registra le informazioni trovate nei documenti e i campi CRM che propongono di valorizzare.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["riepilogo", "campi"],
    properties: {
      riepilogo: {
        type: "string",
        description:
          "Due o tre frasi in italiano su cosa contengono i documenti, rivolte a un collega " +
          "commerciale. Nessun elenco: l'elenco dei campi lo mostra gia' l'interfaccia.",
      },
      campi: {
        type: "array",
        description:
          "Un elemento per ogni campo CRM che i documenti permettono di valorizzare. Vuoto se " +
          "i documenti non contengono niente di utile.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["campo", "valore", "fonte"],
          properties: {
            campo: {
              type: "string",
              description: "Nome esatto del campo, copiato dall'elenco dei campi disponibili.",
            },
            valore: {
              type: "string",
              description:
                "Il valore letto nel documento, senza unita' di misura ne' commenti. Date in " +
                "formato gg/mm/aaaa, numeri con la virgola decimale, si/no per i campi booleani.",
            },
            fonte: {
              type: "string",
              description: "Percorso del file da cui viene il valore, copiato dall'elenco dei file.",
            },
          },
        },
      },
    },
  },
}

function elencoCampi(entita: EntitaAI): string {
  return CAMPI_AI[entita]
    .map((campo) => {
      const tipo = `[${campo.tipo}]`
      return `- ${campo.etichetta} ${tipo}${campo.nota ? ` — ${campo.nota}` : ""}`
    })
    .join("\n")
}

export async function leggiDocumenti(params: {
  entita: EntitaAI
  nome: string
  contenuti: ContenutoFile[]
  /** I valori gia' presenti sul record, per non riproporre gli identici. */
  valoriAttuali: Record<string, unknown> | null
}): Promise<EstrazioneDocumenti> {
  const blocchi: BloccoContenuto[] = []

  for (const contenuto of params.contenuti) {
    blocchi.push({ type: "text", text: `--- File: ${contenuto.file.path} ---` })
    if (contenuto.mediaType === "application/pdf") {
      blocchi.push({
        type: "document",
        title: contenuto.file.nome,
        source: { type: "base64", media_type: contenuto.mediaType, data: contenuto.base64 },
      })
    } else if (contenuto.mediaType.startsWith("image/")) {
      blocchi.push({
        type: "image",
        source: { type: "base64", media_type: contenuto.mediaType, data: contenuto.base64 },
      })
    } else {
      // Nessun parser dedicato: il contenuto grezzo va al modello cosi'
      // com'e'. Su un formato binario leggera' quello che riesce a leggere,
      // e se non trova niente restituira' semplicemente zero campi.
      const testo = Buffer.from(contenuto.base64, "base64").toString("utf8")
      blocchi.push({ type: "text", text: testo.slice(0, 200_000) })
    }
  }

  const attuali = params.valoriAttuali
    ? Object.entries(params.valoriAttuali)
        .filter(([chiave, valore]) => chiave !== "id" && valore != null && valore !== "")
        .map(([chiave, valore]) => `- ${chiave}: ${String(valore)}`)
        .join("\n")
    : null

  blocchi.push({
    type: "text",
    text: [
      `Tipo di record: ${ENTITA_LABEL[params.entita]}. Persona: ${params.nome}.`,
      "",
      "Campi disponibili (usa esattamente queste etichette):",
      elencoCampi(params.entita),
      "",
      attuali
        ? `Valori gia' presenti sul record:\n${attuali}\n\nProponi comunque il valore che leggi nei documenti, anche dove il record e' gia' pieno: al confronto ci pensa il CRM. Ometti solo i campi il cui valore letto e' identico a quello gia' presente.`
        : "Il record non esiste ancora: quello che estrai servira' a crearlo.",
      "",
      "Registra il risultato chiamando il tool registra_estrazione.",
    ].join("\n"),
  })

  const input = await chiamaClaude({
    system:
      "Sei SolairAI, l'assistente del CRM Solair. Leggi i documenti allegati ed estrai le " +
      "informazioni che valorizzano i campi CRM elencati.\n\n" +
      "Regole non negoziabili:\n" +
      "- Non inventare nulla. Se un dato non c'e' nei documenti, il campo non va proposto.\n" +
      "- Non dedurre un valore da un altro (niente province ricavate dal CAP, niente totali calcolati).\n" +
      "- Un campo che non compare nell'elenco non esiste: non proporlo.\n" +
      "- La fonte di ogni campo e' il percorso del file in cui hai letto quel dato, non un altro.\n" +
      "- Se i documenti riguardano una persona diversa da quella indicata, dillo nel riepilogo e non proporre campi.",
    messaggi: [{ role: "user", content: blocchi }],
    tool: TOOL_ESTRAI,
    maxTokens: 8000,
  })

  const campiGrezzi = Array.isArray(input.campi) ? input.campi : []
  return {
    riepilogo:
      stringa(input.riepilogo) ??
      stringa(input.__testo) ??
      "Ho letto i documenti ma non sono riuscito a riassumerli.",
    campi: campiGrezzi
      .map((voce) => {
        const riga = voce as Record<string, unknown>
        return {
          campo: stringa(riga.campo) ?? "",
          valore: stringa(riga.valore) ?? "",
          fonte: stringa(riga.fonte) ?? "",
        }
      })
      .filter((voce) => voce.campo !== "" && voce.valore !== ""),
  }
}

// ---------------------------------------------------------------------------
// 3. Risposta da indice documentale
// ---------------------------------------------------------------------------

const TOOL_RISPONDI_INDICE: ToolClaude = {
  name: "rispondi_da_indice",
  description: "Registra la risposta alla domanda usando solo gli estratti documentali forniti.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["risposta"],
    properties: {
      risposta: {
        type: "string",
        description:
          "Risposta in italiano. Usa solo gli estratti forniti e cita i percorsi file rilevanti.",
      },
    },
  },
}

export async function rispondiDaIndiceSolairAI(params: {
  domanda: string
  risultati: SolairAiKnowledgeSnippet[]
}): Promise<string> {
  if (params.risultati.length === 0) {
    return "Non trovo ancora informazioni utili nell'indice documentale SolairAI."
  }

  const estratti = params.risultati
    .map(
      (risultato, index) =>
        [
          `Fonte ${index + 1}`,
          `Modulo: ${ENTITA_LABEL[risultato.entita]}`,
          `File: ${risultato.path}`,
          `Estratto:\n${risultato.contenuto.slice(0, 3000)}`,
        ].join("\n"),
    )
    .join("\n\n---\n\n")

  const input = await chiamaClaude({
    system:
      "Sei SolairAI, l'assistente documentale del CRM Solair. Rispondi alle domande usando " +
      "solo gli estratti dell'indice Nextcloud autorizzato. Se gli estratti non bastano, dillo " +
      "chiaramente. Cita sempre i percorsi file da cui prendi le informazioni.",
    messaggi: [
      {
        role: "user",
        content: `Domanda:\n${params.domanda}\n\nEstratti disponibili:\n${estratti}`,
      },
    ],
    tool: TOOL_RISPONDI_INDICE,
    maxTokens: 3000,
  })

  return stringa(input.risposta) ?? stringa(input.__testo) ??
    "Ho trovato documenti pertinenti, ma non sono riuscito a comporre una risposta leggibile."
}
