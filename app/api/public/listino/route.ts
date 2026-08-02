import { NextResponse } from "next/server"
import { listFolder, downloadFile, type WebDavItem } from "@/lib/nextcloud/admin-webdav"
import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"
import { createAdminClient } from "@/lib/supabase/admin"

// Nodejs runtime: si legge da Nextcloud via WebDAV admin e si bufferizza in
// memoria per l'estrazione del testo (Buffer non esiste su edge).
export const runtime = "nodejs"

// A regime la risposta arriva quasi tutta dalla cache e la chiamata e' veloce,
// ma il primo giro (o dopo un aggiornamento massivo dei listini) deve
// scaricare ed estrarre tutti i PDF: il margine serve per quel caso.
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
  testo: string
  // Presente solo per i PDF senza testo estraibile (scansioni immagine):
  // il chiamante li passa al modello come documento PDF da leggere via
  // vision. Assente su tutti gli altri, che viaggiano come solo testo.
  contenuto_base64?: string
}

type RigaCache = {
  path: string
  fingerprint: string
  testo_estratto: string | null
}

type Estrazione = {
  testo: string | null
  // Valorizzato solo quando `testo` e' null, riusando il buffer gia'
  // scaricato: nessun secondo download per gli stessi file.
  base64: string | null
}

type DaProcessare = {
  path: string
  nome: string
  cartella: string
  fingerprint: string
}

function isPdf(nome: string): boolean {
  return nome.toLowerCase().endsWith(".pdf")
}

/**
 * Impronta del file per capire se e' cambiato dall'ultima estrazione.
 *
 * L'ETag Nextcloud e' la fonte migliore: cambia ad ogni modifica del
 * contenuto. Il fallback su dimensione+data serve solo se il server non lo
 * restituisce, ed e' meno preciso perche' `dimensioneKb` e' arrotondato al KB
 * (una modifica sotto il mezzo KB a parita' di data passerebbe inosservata).
 */
function fingerprintDi(item: WebDavItem): string {
  if (item.etag) return `etag:${item.etag}`
  return `size-mtime:${item.dimensioneKb ?? "?"}-${item.modificato ?? "?"}`
}

/**
 * Voce di risposta: `contenuto_base64` compare solo se valorizzato, cosi' i
 * documenti testuali (la stragrande maggioranza) restano leggeri.
 */
function documento(
  file: DaProcessare,
  testo: string | null,
  base64: string | null,
): DocumentoListino {
  return {
    nome: file.nome,
    cartella: file.cartella,
    testo: testo ?? "",
    ...(base64 ? { contenuto_base64: base64 } : {}),
  }
}

async function pdfDellaCartella(etichetta: string, fullPath: string): Promise<DaProcessare[]> {
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

  return listing.items
    .filter((item) => !item.isFolder && isPdf(item.nome))
    .map((item) => ({
      path: item.path,
      nome: item.nome,
      cartella: etichetta,
      fingerprint: fingerprintDi(item),
    }))
}

/**
 * Scarica il PDF ed estrae il testo.
 *
 * Se il PDF non contiene testo (scansione immagine) restituisce il contenuto
 * in base64 riusando il buffer gia' scaricato, cosi' il chatbot puo' leggerlo
 * via vision invece di ricevere un documento vuoto. E' l'eccezione, non la
 * regola: oggi riguarda 3 file su 27, ed e' il motivo per cui il base64 non e'
 * sparito del tutto dalla risposta.
 *
 * Se il file non e' raggiungibile o e' illeggibile restituisce tutto null (con
 * log): un singolo PDF problematico non deve far cadere l'intera risposta, il
 * documento verra' comunque esposto con nome+cartella e testo vuoto.
 */
/**
 * Riscarica un PDF gia' noto come scansione e lo restituisce in base64, senza
 * ritentare l'estrazione del testo. Null (con log) se non e' raggiungibile.
 */
async function scaricaBase64(path: string): Promise<string | null> {
  const result = await downloadFile(path)
  if (!result.ok || !result.body) {
    console.error(
      `[listino] download fallito per "${path}": ${result.error ?? `HTTP ${result.status}`}`,
    )
    return null
  }
  try {
    const buffer = Buffer.from(await new Response(result.body).arrayBuffer())
    return buffer.toString("base64")
  } catch (error) {
    const message = error instanceof Error ? error.message : "errore lettura stream"
    console.error(`[listino] lettura contenuto fallita per "${path}": ${message}`)
    return null
  }
}

async function estraiContenuto(path: string): Promise<Estrazione> {
  const result = await downloadFile(path)
  if (!result.ok || !result.body) {
    console.error(
      `[listino] download fallito per "${path}": ${result.error ?? `HTTP ${result.status}`}`,
    )
    return { testo: null, base64: null }
  }

  try {
    const buffer = new Uint8Array(await new Response(result.body).arrayBuffer())
    const testo = await estraiTestoDaPdf(buffer)
    if (testo != null) return { testo, base64: null }

    console.warn(
      `[listino] nessun testo estraibile da "${path}" (scansione immagine): si conserva il PDF`,
    )
    return { testo: null, base64: Buffer.from(buffer).toString("base64") }
  } catch (error) {
    const message = error instanceof Error ? error.message : "errore estrazione"
    console.error(`[listino] estrazione fallita per "${path}": ${message}`)
    return { testo: null, base64: null }
  }
}

/**
 * Endpoint pubblico di sola lettura per il chatbot del sito: espone il TESTO
 * dei PDF di listino/offerte presenti su Nextcloud.
 *
 * Il testo viene estratto una sola volta per versione del file e conservato in
 * `listino_cache`: ad ogni chiamata si fa solo la PROPFIND (leggera) e si
 * riscarica soltanto cio' che e' cambiato, confrontando il fingerprint.
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

  const supabase = createAdminClient()
  if (!supabase) {
    console.error("[listino] Supabase admin client non configurato")
    return NextResponse.json({ error: "Sorgente non configurata" }, { status: 503 })
  }

  try {
    const perCartella = await Promise.all(
      CARTELLE_LISTINO.map((c) => pdfDellaCartella(c.etichetta, c.fullPath)),
    )
    const files = perCartella.flat()

    if (files.length === 0) {
      return NextResponse.json({ documenti: [] })
    }

    // Una sola query per tutti i path: la cache e' piccola (una riga per PDF).
    const { data: righe, error: erroreLettura } = await supabase
      .from("listino_cache")
      .select("path, fingerprint, testo_estratto")
      .in(
        "path",
        files.map((f) => f.path),
      )

    if (erroreLettura) {
      // Si prosegue senza cache: la risposta e' corretta comunque, solo lenta.
      console.error(`[listino] lettura cache fallita: ${erroreLettura.message}`)
    }

    const cache = new Map<string, RigaCache>(
      ((righe as RigaCache[] | null) ?? []).map((r) => [r.path, r]),
    )

    let riusati = 0
    let scansioni = 0
    const daSalvare: {
      path: string
      nome: string
      cartella: string
      fingerprint: string
      testo_estratto: string | null
      aggiornato_at: string
    }[] = []

    const documenti = await Promise.all(
      files.map(async (file): Promise<DocumentoListino> => {
        const inCache = cache.get(file.path)

        // Fingerprint invariato: si riusa il testo gia' estratto, senza
        // riscaricare ne' ri-processare il file.
        if (inCache && inCache.fingerprint === file.fingerprint) {
          riusati++
          if (inCache.testo_estratto) return documento(file, inCache.testo_estratto, null)

          // Riga in cache con testo null = scansione immagine gia' analizzata:
          // non si ritenta l'estrazione (sarebbe di nuovo vuota), si riscarica
          // solo il PDF da passare al modello. Sono pochi file e pesano poco:
          // tenerne il base64 in tabella costerebbe MB di righe Postgres per
          // risparmiare circa un secondo su una chiamata gia' rara.
          scansioni++
          return documento(file, null, await scaricaBase64(file.path))
        }

        const { testo, base64 } = await estraiContenuto(file.path)
        if (base64) scansioni++
        daSalvare.push({
          path: file.path,
          nome: file.nome,
          cartella: file.cartella,
          fingerprint: file.fingerprint,
          testo_estratto: testo,
          aggiornato_at: new Date().toISOString(),
        })
        return documento(file, testo, base64)
      }),
    )

    if (daSalvare.length > 0) {
      const { error: erroreScrittura } = await supabase
        .from("listino_cache")
        .upsert(daSalvare, { onConflict: "path" })

      // La risposta al chiamante e' gia' corretta: un upsert fallito costa
      // solo una ri-estrazione alla chiamata successiva.
      if (erroreScrittura) {
        console.error(`[listino] upsert cache fallito: ${erroreScrittura.message}`)
      }
    }

    console.log(
      `[listino] ${documenti.length} documenti: ${riusati} da cache, ${daSalvare.length} estratti ora, ${scansioni} serviti come PDF (scansioni)`,
    )

    return NextResponse.json({ documenti })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore lettura listini"
    console.error("[listino]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
