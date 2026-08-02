import { NextResponse } from "next/server"
import { listFolder, downloadFile } from "@/lib/nextcloud/admin-webdav"

// Nodejs runtime: si legge da Nextcloud via WebDAV admin e si bufferizza in
// memoria per la conversione base64 (Buffer non esiste su edge).
export const runtime = "nodejs"

// I PDF di listino sono pochi ma pesanti (alcuni MB l'uno) e vanno scaricati
// tutti prima di poter rispondere: il default di 10s sta stretto. 60s e' un
// margine ampio, non una stima — vedi nota sui tempi in fondo al file.
export const maxDuration = 60

// Prefisso "Solair/" = Team Folder condivisa vista dall'account admin, stessa
// convenzione di lib/allegati/paths.ts (TEAM_FOLDER_ROOT). `etichetta` e' il
// path senza quel prefisso, cioe' come le cartelle sono note agli utenti e
// come compaiono in path-permissions.ts.
const CARTELLE_LISTINO = [
  { etichetta: "Vendita-Digitale/LISTINI", fullPath: "Solair/Vendita-Digitale/LISTINI" },
  { etichetta: "Solair-Agenti/LISTINI", fullPath: "Solair/Solair-Agenti/LISTINI" },
] as const

type DocumentoListino = {
  nome: string
  cartella: string
  contenuto_base64: string
}

function isPdf(nome: string): boolean {
  return nome.toLowerCase().endsWith(".pdf")
}

/**
 * Scarica un file da Nextcloud e lo restituisce in base64. Null (con log) se
 * il download fallisce: un singolo PDF irraggiungibile non deve far cadere
 * l'intera risposta, il chatbot lavora con quello che c'e'.
 */
async function scaricaBase64(fullPath: string): Promise<string | null> {
  const result = await downloadFile(fullPath)
  if (!result.ok || !result.body) {
    console.error(
      `[listino] download fallito per "${fullPath}": ${result.error ?? `HTTP ${result.status}`}`,
    )
    return null
  }
  try {
    const buffer = Buffer.from(await new Response(result.body).arrayBuffer())
    return buffer.toString("base64")
  } catch (error) {
    const message = error instanceof Error ? error.message : "errore lettura stream"
    console.error(`[listino] lettura contenuto fallita per "${fullPath}": ${message}`)
    return null
  }
}

async function documentiDiCartella(
  etichetta: string,
  fullPath: string,
): Promise<DocumentoListino[]> {
  const listing = await listFolder(fullPath)

  // 404 = cartella assente: listFolder la restituisce gia' come ok+vuota
  // (stesso comportamento del modulo Documenti). Un errore vero (rete,
  // credenziali, 5xx) lo si logga ma si continua con le altre cartelle,
  // cosi' l'endpoint degrada invece di fallire in blocco.
  if (!listing.ok) {
    console.error(
      `[listino] listing fallito per "${fullPath}": ${listing.error ?? `HTTP ${listing.status}`}`,
    )
    return []
  }

  const pdf = listing.items.filter((item) => !item.isFolder && isPdf(item.nome))

  const documenti = await Promise.all(
    pdf.map(async (item) => {
      const contenuto = await scaricaBase64(item.path)
      return contenuto == null
        ? null
        : { nome: item.nome, cartella: etichetta, contenuto_base64: contenuto }
    }),
  )

  return documenti.filter((doc): doc is DocumentoListino => doc !== null)
}

/**
 * Endpoint pubblico di sola lettura per il chatbot del sito: espone i PDF di
 * listino/offerte presenti su Nextcloud, in base64.
 *
 * Nessuna sessione CRM (il middleware esclude /api/public/*): si autentica da
 * solo con una API key statica in Authorization: Bearer, stesso schema di
 * /api/public/lead-intake. Le cartelle esposte sono fisse e hardcoded — non
 * si accetta nessun path dal chiamante, perche' la richiesta WebDAV parte con
 * le credenziali admin.
 */
export async function GET(request: Request) {
  const expectedKey = process.env.LISTINO_READ_KEY
  if (!expectedKey) {
    console.error("[listino] LISTINO_READ_KEY non configurata")
    return NextResponse.json({ error: "Sorgente non configurata" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const providedKey = authHeader.replace(/^Bearer\s+/i, "")
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  try {
    const perCartella = await Promise.all(
      CARTELLE_LISTINO.map((c) => documentiDiCartella(c.etichetta, c.fullPath)),
    )
    return NextResponse.json({ documenti: perCartella.flat() })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore lettura listini"
    console.error("[listino]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
