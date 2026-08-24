import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { nomeSenzaCollisioni, sanitizeName } from "@/lib/allegati/paths"
import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"
import {
  deleteFile,
  downloadAdminFile,
  ensureFolder,
  listFolder,
  moveFile,
  uploadFile,
} from "@/lib/nextcloud/admin-webdav"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Area Nextcloud.
 *
 * Tutto passa dalle credenziali ADMIN (admin-webdav.ts), mai da
 * NEXTCLOUD_ASSET_USER e mai dalle app-password personali: quelle esistono solo
 * dentro una sessione browser, e per giunta un utente provisionato non vede la
 * Team Folder "Solair" — un upload fatto con le sue credenziali finirebbe nella
 * sua home, con il link pubblico che risponde 404 senza dire niente.
 *
 * Verificato dal vivo il 24/08/2026, e con questo cade il punto lasciato
 * aperto in lib/allegati/paths.ts: l'account admin vede "Solair" direttamente
 * alla radice DAV, e i percorsi registrati dal sync (che gira con le
 * credenziali personali) rispondono 200 identici anche da admin. Le due viste
 * coincidono, TEAM_FOLDER_ROOT e' corretto.
 */

/** Limite sul corpo base64 in ingresso e in uscita: ~12 MB di file. */
const LIMITE_BYTE = 12 * 1024 * 1024

/**
 * Perimetro dei tool Nextcloud: la Team Folder "Solair" e nient'altro.
 *
 * L'account admin vede alla radice DAV anche Documents, Photos, Templates e la
 * propria home: non sono dati Solair e non hanno ragione di essere raggiungibili
 * da un tool che cancella. Il resto dell'albero aziendale e' tutto qui sotto
 * (Vendita-Digitale, Offerta-Commerciale, Solair-Agenti, Solair-Ufficio).
 */
const RADICE = "Solair"

/**
 * Un path valido: dentro il perimetro, senza traversal e — per le operazioni
 * distruttive — mai la Team Folder nuda, cosi' "cancella tutto" non puo'
 * nascere da un argomento sbagliato.
 */
function pathValido(
  path: string,
  { permettiRadice = false, distruttivo = false } = {},
): string {
  const pulito = path.trim().replace(/^\/+|\/+$/g, "")
  if (!pulito) {
    if (!permettiRadice) throw new Error("Percorso obbligatorio")
    return RADICE
  }
  if (pulito.split("/").some((segmento) => segmento === "." || segmento === "..")) {
    throw new Error(`Percorso non valido: "${path}"`)
  }
  if (pulito !== RADICE && !pulito.startsWith(`${RADICE}/`)) {
    throw new Error(
      `Percorso fuori perimetro: i tool Nextcloud lavorano solo dentro "${RADICE}/". Ricevuto "${path}".`,
    )
  }
  if (distruttivo && pulito === RADICE) {
    throw new Error(`"${RADICE}" e' la Team Folder intera: non e' un bersaglio ammesso per questa operazione.`)
  }
  return pulito
}

function cartellaDi(path: string): string {
  return path.split("/").slice(0, -1).join("/")
}

export function registraToolNextcloud(server: McpServer): void {
  registraTool(server, {
    nome: "nextcloud_browse",
    titolo: "Sfoglia una cartella",
    descrizione:
      "Elenca il contenuto di una cartella Nextcloud: sottocartelle e file con dimensione e data di " +
      "modifica. Senza percorso elenca la Team Folder Solair, che e' il perimetro di tutti i tool " +
      "Nextcloud. Una cartella che non esiste torna vuota, non in errore.",
    schema: {
      path: z.string().optional().describe("Percorso dentro Solair/, es. 'Solair/Vendita-Digitale'. Vuoto = Solair."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ path }) => {
      const cartella = pathValido(path ?? "", { permettiRadice: true })
      const esito = await listFolder(cartella)
      if (!esito.ok) throw new Error(esito.error ?? `Lettura cartella fallita (HTTP ${esito.status})`)
      return {
        dati: {
          path: cartella,
          esiste: esito.status !== 404,
          elementi: esito.items,
        },
        righe: esito.items.length,
      }
    },
  })

  registraTool(server, {
    nome: "nextcloud_download_file",
    titolo: "Scarica un file",
    descrizione:
      "Scarica un file da Nextcloud. Di default restituisce il contenuto in base64; per i PDF si puo' " +
      "chiedere solo_testo, che estrae il testo senza far viaggiare il binario — molto piu' leggero " +
      "quando serve leggere un listino o una scheda tecnica.",
    schema: {
      path: z.string().min(1),
      solo_testo: z.boolean().optional().describe("Solo per i PDF: restituisce il testo estratto invece del base64."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ path, solo_testo }) => {
      const file = pathValido(path)
      const risposta = await downloadAdminFile(file)
      const buffer = Buffer.from(await risposta.arrayBuffer())
      const contentType = risposta.headers.get("content-type") ?? "application/octet-stream"

      if (solo_testo) {
        // estraiTestoDaPdf distingue i due casi: null = PDF valido ma senza
        // testo (una scansione), eccezione = non e' un PDF leggibile. Senza
        // questo try il messaggio che arriva al modello e' quello di pdf.js
        // ("Invalid PDF structure"), che non dice cosa fare.
        let testo: string | null
        try {
          testo = await estraiTestoDaPdf(new Uint8Array(buffer))
        } catch {
          throw new Error(
            `"${file}" non e' un PDF leggibile (content-type ${contentType}): richiedi il file senza solo_testo.`,
          )
        }
        if (testo === null) {
          throw new Error(
            `"${file}" e' un PDF senza testo estraibile, probabilmente una scansione: richiedilo senza solo_testo.`,
          )
        }
        return { dati: { path: file, content_type: contentType, byte: buffer.byteLength, testo }, righe: 1 }
      }

      if (buffer.byteLength > LIMITE_BYTE) {
        throw new Error(
          `File troppo grande da restituire in base64 (${Math.round(buffer.byteLength / 1024 / 1024)} MB, limite ${LIMITE_BYTE / 1024 / 1024} MB). ` +
            "Se e' un PDF usa solo_testo.",
        )
      }
      return {
        dati: { path: file, content_type: contentType, byte: buffer.byteLength, contenuto_base64: buffer.toString("base64") },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "nextcloud_create_folder",
    titolo: "Crea una cartella",
    descrizione:
      "Crea una cartella e tutte le intermedie mancanti. Se esiste gia' non e' un errore: l'operazione " +
      "e' ripetibile senza conseguenze.",
    schema: { path: z.string().min(1) },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ path }) => {
      const cartella = pathValido(path)
      const esito = await ensureFolder(cartella)
      if (!esito.ok) throw new Error(esito.error ?? `Creazione cartella fallita (HTTP ${esito.status})`)
      return { dati: { path: cartella, creata: true }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "nextcloud_upload_file",
    titolo: "Carica un file",
    descrizione:
      "Carica un file in una cartella, creandola se manca. Il nome viene ripulito dai caratteri non " +
      "ammessi e, se in cartella esiste gia' un file con quel nome, ne riceve uno progressivo " +
      "(nome_2.pdf): un upload non sovrascrive mai in silenzio.",
    schema: {
      path_cartella: z.string().min(1),
      nome_file: z.string().min(1),
      contenuto_base64: z.string().min(1),
      content_type: z.string().optional().describe("Es. application/pdf. Se assente lo decide Nextcloud."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async ({ path_cartella, nome_file, contenuto_base64, content_type }) => {
      const cartella = pathValido(path_cartella)
      const nomePulito = sanitizeName(nome_file)
      if (!nomePulito || /^\.+$/.test(nomePulito)) throw new Error(`Nome file non valido: "${nome_file}"`)

      const buffer = Buffer.from(contenuto_base64, "base64")
      if (buffer.byteLength === 0) throw new Error("Contenuto vuoto o base64 non valido")
      if (buffer.byteLength > LIMITE_BYTE) {
        throw new Error(`File troppo grande (${Math.round(buffer.byteLength / 1024 / 1024)} MB, limite ${LIMITE_BYTE / 1024 / 1024} MB)`)
      }

      // Si guarda la cartella reale prima del PUT: WebDAV sovrascriverebbe
      // senza dire niente. Stessa regola della route allegati.
      const esistenti = await listFolder(cartella)
      const nomeFinale = nomeSenzaCollisioni(
        nomePulito,
        esistenti.ok ? esistenti.items.filter((i) => !i.isFolder).map((i) => i.nome) : [],
      )

      const destinazione = `${cartella}/${nomeFinale}`
      const esito = await uploadFile(destinazione, buffer, content_type)
      if (!esito.ok) throw new Error(esito.error ?? `Upload fallito (HTTP ${esito.status})`)
      return {
        dati: {
          path: destinazione,
          rinominato: nomeFinale !== nomePulito ? `"${nomePulito}" era gia' preso` : undefined,
          byte: buffer.byteLength,
        },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "nextcloud_rename",
    titolo: "Rinomina un file o una cartella",
    descrizione:
      "Cambia il nome lasciando l'elemento dov'e'. Se nella stessa cartella esiste gia' qualcosa con " +
      "il nuovo nome l'operazione si ferma, senza sovrascrivere.",
    schema: {
      path: z.string().min(1),
      nuovo_nome: z.string().min(1).describe("Solo il nome, senza percorso."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async ({ path, nuovo_nome }) => {
      const origine = pathValido(path, { distruttivo: true })
      const nome = sanitizeName(nuovo_nome)
      if (!nome || /^\.+$/.test(nome) || nome.includes("/")) {
        throw new Error(`Nome non valido: "${nuovo_nome}". Passa solo il nome, non un percorso.`)
      }
      const cartella = cartellaDi(origine)
      const destinazione = cartella ? `${cartella}/${nome}` : nome
      if (destinazione === origine) return { dati: { path: origine, invariato: true }, righe: 0 }

      const esito = await moveFile(origine, destinazione)
      if (!esito.ok) throw new Error(esito.error ?? `Rinomina fallita (HTTP ${esito.status})`)
      return { dati: { da: origine, a: destinazione }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "nextcloud_move",
    titolo: "Sposta un file o una cartella",
    descrizione:
      "Sposta un elemento in un'altra cartella, creandola se manca. Spostare la cartella di un record " +
      "(lead, cliente, installatore) fuori dal suo posto la rende invisibile al CRM, che ricalcola il " +
      "percorso dal nome e dall'id: e' il motivo per cui questa operazione va trattata con attenzione. " +
      "Se la destinazione esiste gia', si ferma senza sovrascrivere.",
    schema: {
      path_origine: z.string().min(1),
      path_destinazione: z.string().min(1).describe("Percorso completo di destinazione, nome del file incluso."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ path_origine, path_destinazione }) => {
      const origine = pathValido(path_origine, { distruttivo: true })
      const destinazione = pathValido(path_destinazione)
      if (origine === destinazione) return { dati: { path: origine, invariato: true }, righe: 0 }
      if (destinazione.startsWith(`${origine}/`)) {
        throw new Error("Non si puo' spostare una cartella dentro se stessa")
      }
      const esito = await moveFile(origine, destinazione)
      if (!esito.ok) throw new Error(esito.error ?? `Spostamento fallito (HTTP ${esito.status})`)
      return { dati: { da: origine, a: destinazione }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "nextcloud_delete",
    titolo: "Elimina un file o una cartella",
    descrizione:
      "Elimina un file o un'intera cartella con tutto il suo contenuto. Su Nextcloud l'elemento passa " +
      "dal cestino, ma il CRM non lo sa: se e' la cartella di un record, gli allegati spariscono dalla " +
      "sua scheda. Un percorso gia' inesistente non e' un errore.",
    schema: { path: z.string().min(1) },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ path }) => {
      const bersaglio = pathValido(path, { distruttivo: true })
      const esito = await deleteFile(bersaglio)
      if (!esito.ok) throw new Error(esito.error ?? `Eliminazione fallita (HTTP ${esito.status})`)
      return { dati: { path: bersaglio, eliminato: true, gia_assente: esito.status === 404 }, righe: 1 }
    },
  })
}
