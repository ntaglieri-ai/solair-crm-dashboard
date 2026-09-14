import { NextResponse } from "next/server"

import { folderPathForRecord, type AllegatoRecordTipo } from "@/lib/allegati/paths"
import { listFolder as listFolderAdmin, downloadAdminFile } from "@/lib/nextcloud/admin-webdav"
import { nextcloudAdminConfig } from "@/lib/nextcloud/config"
import { listFolder as listFolderUtente, downloadFile as downloadFileUtente } from "@/lib/nextcloud/webdav"
import { canAccessCrmRecord } from "@/lib/permissions/data-scope"
import { requireApiPage } from "@/lib/permissions/server"
import { leggiDocumenti } from "@/lib/solair-ai/claude"
import { risolviCampoAI } from "@/lib/solair-ai/campi"
import { leggiRecord } from "@/lib/solair-ai/records"
import {
  MAX_FILE_PER_TURNO,
  mediaTypeDi,
  soloNuovi,
  type ContenutoFile,
} from "@/lib/solair-ai/nextcloud"
import {
  ENTITA_ARTICOLO,
  ENTITA_LABEL,
  isEntitaAI,
  type FileCandidato,
  type RisposteChat,
} from "@/lib/solair-ai/tipi"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type Payload = {
  entita?: unknown
  recordId?: unknown
  nome?: unknown
}

const MAX_BYTE_FILE = 25 * 1024 * 1024
const FILE_DI_SISTEMA = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  "Icon\r",
])

const MODULO_RECORD: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

type VoceTecnica = {
  path: string
  nome: string
  isFolder: boolean
  byte: number | null
  modificato: string | null
  etag: string | null
}

type AccessoTecnico = {
  listFolder(path: string): Promise<VoceTecnica[]>
  downloadFile(path: string): Promise<Response>
}

function risposta(
  messaggio: string,
  stato: RisposteChat["stato"],
  extra: Partial<RisposteChat> = {},
) {
  return NextResponse.json({
    messaggio,
    stato,
    attendeConferma: false,
    ...extra,
  } satisfies RisposteChat)
}

function fingerprintDi(file: { etag: string | null; byte: number | null; modificato: string | null }) {
  if (file.etag) return `etag:${file.etag}`
  return `size-mtime:${file.byte ?? "?"}-${file.modificato ?? "?"}`
}

function fileLeggibile(voce: VoceTecnica): boolean {
  if (voce.isFolder) return false
  if ((voce.byte ?? 0) > MAX_BYTE_FILE) return false

  const nome = voce.nome.trim()
  if (!nome) return false
  if (nome.startsWith(".")) return false
  if (FILE_DI_SISTEMA.has(nome)) return false
  if (voce.path.split("/").some((segmento) => segmento === "__MACOSX")) return false

  return true
}

function assetCredentials(): { username: string; appPassword: string } | null {
  const username = process.env.NEXTCLOUD_ASSET_USER
  const appPassword = process.env.NEXTCLOUD_ASSET_PASSWORD
  if (!username || !appPassword) return null
  return { username, appPassword }
}

function accessoTecnicoNextcloud(): AccessoTecnico | null {
  if (nextcloudAdminConfig()) {
    return {
      listFolder: async (path) => {
        const esito = await listFolderAdmin(path)
        if (!esito.ok) {
          throw new Error(esito.error ?? `Lettura cartella fallita (HTTP ${esito.status})`)
        }
        return esito.items.map((voce) => ({
          path: voce.path,
          nome: voce.nome,
          isFolder: voce.isFolder,
          byte: voce.byte,
          modificato: voce.modificato,
          etag: voce.etag,
        }))
      },
      downloadFile: downloadAdminFile,
    }
  }

  const asset = assetCredentials()
  if (!asset) return null

  return {
    listFolder: async (path) =>
      (await listFolderUtente(asset.username, asset.appPassword, path)).map((voce) => ({
        path: voce.path,
        nome: voce.name,
        isFolder: voce.isDir,
        byte: voce.size,
        modificato: voce.lastModified,
        etag: voce.etag,
      })),
    downloadFile: (path) => downloadFileUtente(asset.username, asset.appPassword, path),
  }
}

async function scaricaContenuti(accesso: AccessoTecnico, file: FileCandidato[]): Promise<ContenutoFile[]> {
  return Promise.all(
    file.map(async (voce) => {
      const risposta = await accesso.downloadFile(voce.path)
      const buffer = Buffer.from(await risposta.arrayBuffer())
      return {
        file: voce,
        base64: buffer.toString("base64"),
        mediaType: mediaTypeDi(voce.nome) ?? "text/plain",
      }
    }),
  )
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
  const entita = body?.entita
  const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : ""
  const nome = typeof body?.nome === "string" ? body.nome.trim() : ""

  if (!isEntitaAI(entita) || !recordId || !nome) {
    return NextResponse.json({ error: "entita, recordId e nome richiesti." }, { status: 400 })
  }

  if (!permissions.canRecord(MODULO_RECORD[entita], "view")) {
    return NextResponse.json({ error: `Non hai il permesso di vedere ${ENTITA_LABEL[entita]}.` }, { status: 403 })
  }
  if (!permissions.canRecord(MODULO_RECORD[entita], "edit")) {
    return NextResponse.json({ error: `Non hai il permesso di modificare ${ENTITA_LABEL[entita]}.` }, { status: 403 })
  }
  if (!(await canAccessCrmRecord(permissions.snapshot, entita, recordId))) {
    return NextResponse.json({ error: "Record non trovato." }, { status: 404 })
  }

  const record = await leggiRecord(entita, recordId)
  if (!record) {
    return NextResponse.json({ error: `${ENTITA_LABEL[entita]} non trovato.` }, { status: 404 })
  }

  const folderPath = folderPathForRecord(entita, recordId, record.etichetta || nome)
  const accesso = accessoTecnicoNextcloud()
  if (!accesso) {
    return risposta(
      "Non riesco a leggere gli allegati: credenziali tecniche Nextcloud non configurate.",
      { entita, nome: record.etichetta, proposta: null },
    )
  }

  let listing: VoceTecnica[]
  try {
    listing = await accesso.listFolder(folderPath)
  } catch (errore) {
    return risposta(
      `Non riesco a leggere la cartella allegati della scheda (${folderPath}): ` +
        (errore instanceof Error ? errore.message : "errore Nextcloud"),
      { entita, nome: record.etichetta, proposta: null },
    )
  }

  const candidati = listing
    .filter(fileLeggibile)
    .map((file) => ({
      path: file.path,
      nome: file.nome,
      dimensione: file.byte,
      modificatoIl: file.modificato,
      fingerprint: fingerprintDi(file),
    }))
    .sort((a, b) => (b.modificatoIl ?? "").localeCompare(a.modificatoIl ?? ""))

  if (candidati.length === 0) {
    return risposta(
      `Nella cartella allegati della scheda ${record.etichetta} non trovo file da leggere.`,
      { entita, nome: record.etichetta, proposta: null },
    )
  }

  const nuovi = await soloNuovi(entita, recordId, candidati)
  if (nuovi.length === 0) {
    return risposta("Nessuna novita': ho gia' letto tutti gli allegati della scheda.", {
      entita,
      nome: record.etichetta,
      proposta: null,
    })
  }

  const daLeggere = nuovi.slice(0, MAX_FILE_PER_TURNO)
  const rimasti = nuovi.length - daLeggere.length

  let estrazione
  try {
    estrazione = await leggiDocumenti({
      entita,
      nome: record.etichetta,
      contenuti: await scaricaContenuti(accesso, daLeggere),
      valoriAttuali: record.valori,
    })
  } catch (errore) {
    return risposta(
      errore instanceof Error ? errore.message : "Non sono riuscito a leggere gli allegati.",
      { entita, nome: record.etichetta, proposta: null },
    )
  }

  const campi = estrazione.campi
    .map((proposto) => {
      const campo = risolviCampoAI(entita, proposto.campo)
      if (!campo) return null
      return {
        campo: campo.column,
        etichetta: campo.etichetta,
        valore: proposto.valore,
        fonte: daLeggere.some((file) => file.path === proposto.fonte)
          ? proposto.fonte
          : (daLeggere[0]?.path ?? ""),
      }
    })
    .filter((campo) => campo !== null)

  const testa = [
    `Ho letto ${daLeggere.length} ${daLeggere.length === 1 ? "allegato nuovo" : "allegati nuovi"} dalla scheda.`,
    rimasti > 0 ? `(Ne restano ${rimasti}: li leggo al prossimo giro.)` : null,
    "",
    estrazione.riepilogo,
  ]
    .filter((riga) => riga !== null)
    .join("\n")

  if (campi.length === 0) {
    return risposta(
      `${testa}\n\nNon ho trovato campi da valorizzare, quindi non ti chiedo niente.`,
      { entita, nome: record.etichetta, proposta: null },
      { file: daLeggere },
    )
  }

  return NextResponse.json({
    messaggio: `${testa}\n\nAggiorno il CRM su ${ENTITA_ARTICOLO[entita]} "${record.etichetta}"?`,
    attendeConferma: true,
    file: daLeggere,
    stato: {
      entita,
      nome: record.etichetta,
      proposta: {
        entita,
        nome: record.etichetta,
        recordId,
        recordEtichetta: record.etichetta,
        campi,
        file: daLeggere,
        riepilogo: estrazione.riepilogo,
      },
    },
  } satisfies RisposteChat)
}
