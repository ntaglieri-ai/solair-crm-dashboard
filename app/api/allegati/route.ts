import { NextResponse } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { ensureFolder, listFolder, uploadFile } from "@/lib/nextcloud/admin-webdav"
import {
  folderPathForRecord,
  nomeSenzaCollisioni,
  sanitizeName,
  type AllegatoRecordTipo,
} from "@/lib/allegati/paths"
import { listCollegamenti } from "@/lib/allegati/repository"
import { canAccessCrmRecord } from "@/lib/permissions/data-scope"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

function isValidTipo(value: string | null): value is AllegatoRecordTipo {
  return value === "lead" || value === "cliente" || value === "installatore"
}

/**
 * Sottocartella opzionale dentro la cartella del record: serve alla sezione
 * "Documenti obbligatori" del Lead, che e' la stessa UI puntata un livello
 * piu' in basso. Stessa sanitizzazione dei nomi cartella creati a mano, con
 * il rifiuto esplicito dei soli punti (sanitizeName non li tocca e "." /
 * ".." darebbero traversal sul path DAV).
 *
 * Ritorna undefined se il valore e' assente, null se e' invalido — cosi' il
 * chiamante distingue "nessuna sottocartella" da "sottocartella sbagliata".
 */
function sottocartellaValida(value: string | null): string | null | undefined {
  if (value === null || value === "") return undefined
  const nome = sanitizeName(value)
  if (!nome || /^\.+$/.test(nome)) return null
  return nome
}

function pathConSottocartella(
  tipo: AllegatoRecordTipo,
  recordId: string,
  nomeRecord: string,
  sottocartella: string | undefined,
): string {
  const base = folderPathForRecord(tipo, recordId, nomeRecord)
  return sottocartella ? `${base}/${sottocartella}` : base
}

/**
 * Sezione "Documenti" degli allegati record: la fonte di verita' e' SOLO la
 * cartella Nextcloud del record (decisione confermata 27/07 con Nando). La
 * tabella `documenti` non viene piu' letta ne' scritta da questo flusso — resta
 * nel DB, ma non e' piu' una fonte. I `collegamenti` (link esterni) restano
 * invece DB-backed: sono un tipo di elemento diverso, non file su Nextcloud.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recordTipo = searchParams.get("recordTipo")
  const recordId = searchParams.get("recordId")
  const nomeRecord = searchParams.get("nomeRecord")

  if (!isValidTipo(recordTipo) || !recordId || !nomeRecord) {
    return NextResponse.json(
      { error: "recordTipo, recordId e nomeRecord richiesti" },
      { status: 400 },
    )
  }

  const sottocartella = sottocartellaValida(searchParams.get("sottocartella"))
  if (sottocartella === null) {
    return NextResponse.json({ error: "Sottocartella non valida" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "view")
  if (guard.response) return guard.response
  if (!(await canAccessCrmRecord(guard.permissions.snapshot, recordTipo, recordId))) {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 })
  }

  try {
    const folderPath = pathConSottocartella(recordTipo, recordId, nomeRecord, sottocartella)
    // I collegamenti (link esterni) sono legati al RECORD, non a una cartella:
    // ripeterli dentro la vista di una sottocartella li mostrerebbe due volte
    // sulla stessa pagina. Restano quindi solo nella sezione principale.
    const [listing, collegamenti] = await Promise.all([
      listFolder(folderPath),
      sottocartella ? Promise.resolve([]) : listCollegamenti(recordTipo, recordId),
    ])

    if (!listing.ok) {
      return NextResponse.json(
        { error: listing.error ?? `Lettura cartella Nextcloud fallita (${listing.status})` },
        { status: 502 },
      )
    }

    // folderPath torna al client cosi' non deve ricalcolarlo: e' anche il path
    // passato a /api/auth/nextcloud/open per il pulsante "Apri in Nextcloud".
    return NextResponse.json({ folderPath, documenti: listing.items, collegamenti })
  } catch (error) {
    console.error("[allegati] GET fallita:", error)
    return NextResponse.json({ error: "Errore nel recupero allegati" }, { status: 500 })
  }
}

/** Creazione sottocartella dentro la cartella del record (body JSON). */
async function creaSottocartella(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    recordTipo?: string
    recordId?: string
    nomeRecord?: string
    nuovaCartella?: string
  } | null

  const recordTipo = body?.recordTipo ?? null
  if (!isValidTipo(recordTipo) || !body?.recordId || !body?.nomeRecord || !body?.nuovaCartella) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "edit")
  if (guard.response) return guard.response
  if (!(await canAccessCrmRecord(guard.permissions.snapshot, recordTipo, body.recordId))) {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 })
  }

  // Stessa sanitizzazione dei nomi record/file (paths.ts); i soli punti sono
  // rifiutati a parte perche' sanitizeName non li tocca e "." / ".." darebbero
  // traversal sul path DAV.
  const nome = sanitizeName(body.nuovaCartella)
  if (!nome || /^\.+$/.test(nome)) {
    return NextResponse.json({ error: "Nome cartella non valido" }, { status: 400 })
  }

  const fullPath = `${folderPathForRecord(recordTipo, body.recordId, body.nomeRecord)}/${nome}`
  // ensureFolder e' gia' idempotente (405 = esiste gia' = non e' un errore).
  const result = await ensureFolder(fullPath)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? `Creazione cartella fallita (${result.status})` },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, path: fullPath }, { status: 201 })
}

/**
 * Nome libero nella cartella di destinazione, verificato sul contenuto reale
 * subito prima del PUT (l'anteprima nel dialog gira su una lista caricata
 * prima, che nel frattempo puo' essere invecchiata).
 *
 * Solo per il flusso della convenzione 5.3 (`convenzione = true`, cioe' nome
 * scelto nel dialog). Gli altri upload conservano di proposito il vecchio
 * comportamento "stesso nome = sostituisci": i "Documenti obbligatori" del
 * Lead hanno un gate che pretende ESATTAMENTE tre file, e ricaricare la
 * versione corretta di un documento diventerebbe un quarto file che blocca la
 * conversione invece di sostituire il precedente.
 *
 * Se la lettura della cartella fallisce si procede col nome richiesto invece
 * di bloccare: e' una protezione, non una precondizione, e in quel caso il PUT
 * successivo fallirebbe comunque per lo stesso motivo.
 */
async function nomeDisponibile(
  cartella: string,
  nomeFile: string,
  convenzione: boolean,
): Promise<string> {
  if (!convenzione) return nomeFile
  const listing = await listFolder(cartella)
  if (!listing.ok) {
    console.warn(
      `[allegati] lettura cartella per anti-collisione fallita (${listing.status}): ${cartella}`,
    )
    return nomeFile
  }
  return nomeSenzaCollisioni(nomeFile, listing.items.map((item) => item.nome))
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return creaSottocartella(request)
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const recordTipo = formData.get("recordTipo") as string | null
  const recordId = formData.get("recordId") as string | null
  const nomeRecord = formData.get("nomeRecord") as string | null

  if (!(file instanceof File) || !isValidTipo(recordTipo) || !recordId || !nomeRecord) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
  }

  const sottocartella = sottocartellaValida(formData.get("sottocartella") as string | null)
  if (sottocartella === null) {
    return NextResponse.json({ error: "Sottocartella non valida" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "edit")
  if (guard.response) return guard.response
  if (!(await canAccessCrmRecord(guard.permissions.snapshot, recordTipo, recordId))) {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 })
  }

  // Nome scelto nel dialog della convenzione 5.3 ({Tipo}_{Cognome}_{AAAAMMGG},
  // estensione inclusa). Il fallback sul nome originale non e' teorico: e' il
  // caso di tutti gli upload che la convenzione non copre (Lead, documenti
  // obbligatori, installatori), che continuano a passare da qui.
  const nomeScelto = sanitizeName((formData.get("nomeFile") as string | null) ?? "")
  const nomeFile = nomeScelto && !/^\.+$/.test(nomeScelto) ? nomeScelto : file.name

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    // Senza sottocartella si carica nella cartella del record; con
    // sottocartella il file va un livello piu' in basso — e' quello che rende
    // contabile il gate dei documenti obbligatori.
    const cartella = pathConSottocartella(recordTipo, recordId, nomeRecord, sottocartella)
    const fullPath = `${cartella}/${await nomeDisponibile(cartella, sanitizeName(nomeFile), Boolean(nomeScelto))}`

    // Nessuna riga su `documenti`: il file compare perche' la GET rilegge
    // sempre il contenuto reale della cartella Nextcloud.
    const uploadResult = await uploadFile(fullPath, buffer, file.type || undefined)
    if (!uploadResult.ok) {
      return NextResponse.json(
        { error: uploadResult.error ?? `Upload Nextcloud fallito (${uploadResult.status})` },
        { status: 502 },
      )
    }

    return NextResponse.json({ path: fullPath }, { status: 201 })
  } catch (error) {
    console.error("[allegati] upload fallito:", error)
    return NextResponse.json({ error: "Errore nel caricamento" }, { status: 500 })
  }
}
