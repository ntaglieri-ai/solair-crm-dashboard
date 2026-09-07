// Backfill una-tantum degli allegati Zoho CRM sui clienti gia' importati.
//
// Uso:
//   node --env-file=.env.local scripts/migrations/backfill-zoho-clienti-allegati.mjs
//   node --env-file=.env.local scripts/migrations/backfill-zoho-clienti-allegati.mjs --apply
//   node --env-file=.env.local scripts/migrations/backfill-zoho-clienti-allegati.mjs --zoho-ids=123,456 --apply
//
// Variabili richieste:
//   ZOHO_ACCESS_TOKEN=...
//   ZOHO_API_DOMAIN=https://www.zohoapis.eu   (opzionale)
//   ZOHO_CLIENTI_MODULE=Clienti               (opzionale)
//
// Lo script e' idempotente: se trova in Nextcloud un file con lo stesso nome e
// la stessa dimensione lo salta; se il nome esiste ma la dimensione cambia,
// carica con suffisso progressivo per non sovrascrivere nulla.

import { createClient } from "@supabase/supabase-js"
import { registerHooks } from "node:module"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        /* non e' un modulo TS: si prosegue con la risoluzione normale */
      }
    }
    return nextResolve(specifier, context)
  },
})

const { listFolder, uploadFile } = await import("../../lib/nextcloud/admin-webdav.ts")
const { folderPathForRecord, nomeSenzaCollisioni, sanitizeName } = await import(
  "../../lib/allegati/paths.ts"
)

const PAGE_SIZE = 500
const ZOHO_PER_PAGE = 200
const DEFAULT_CONCURRENCY = 2
const TENTATIVI = 4
const ATTESA_MS = 900

function arg(name, fallback = null) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function flag(name) {
  return process.argv.includes(`--${name}`)
}

function csvArg(name) {
  const value = arg(name)
  if (!value) return null
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Variabile d'ambiente mancante: ${name}`)
    process.exit(1)
  }
  return value
}

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function nomeCliente(row) {
  return row.nome_clienti || [row.nome, row.cognome].filter(Boolean).join(" ") || row.zoho_record_id
}

function attendi(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function conRetry(etichetta, fn) {
  let ultimoErrore = null
  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    try {
      return await fn()
    } catch (error) {
      ultimoErrore = error
      const status = error?.status ?? 0
      const retryAfter = Number(error?.retryAfter ?? 0)
      const ritentabile = status === 0 || status === 429 || status >= 500
      if (!ritentabile || tentativo === TENTATIVI) break

      const attesa = retryAfter > 0 ? retryAfter * 1000 : ATTESA_MS * tentativo
      console.error(
        `   retry ${etichetta}: tentativo ${tentativo}/${TENTATIVI} fallito (${error.message}), riprovo tra ${Math.round(attesa / 1000)}s`,
      )
      await attendi(attesa)
    }
  }
  throw ultimoErrore
}

function httpError(message, res) {
  const error = new Error(message)
  error.status = res.status
  error.retryAfter = res.headers.get("retry-after")
  return error
}

async function zohoJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw httpError(`Zoho HTTP ${res.status}${body ? `: ${body.slice(0, 220)}` : ""}`, res)
  }
  // Zoho risponde 204 (corpo vuoto) quando il record non ha allegati, invece
  // di 200 con {data: []}. res.json() su un corpo vuoto lancia "Unexpected
  // end of JSON input" — qui lo trattiamo come "nessun dato" invece di farlo
  // esplodere.
  if (res.status === 204) return null
  return res.json()
}

async function zohoDownload(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw httpError(`Zoho download HTTP ${res.status}${body ? `: ${body.slice(0, 220)}` : ""}`, res)
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? undefined,
  }
}

async function fetchClienti(admin, crmIds, zohoIds) {
  const clienti = []
  const zohoFilter = zohoIds ? new Set(zohoIds.map(normalizeZohoId)) : null

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin
      .from("clienti")
      .select("id,zoho_record_id,nome_clienti,nome,cognome")
      .not("zoho_record_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (crmIds) query = query.in("id", crmIds)

    const { data, error } = await query
    if (error) throw new Error(`lettura clienti: ${error.message}`)
    if (!data || data.length === 0) break

    for (const cliente of data) {
      const zohoId = normalizeZohoId(cliente.zoho_record_id)
      if (!zohoId) continue
      if (zohoFilter && !zohoFilter.has(zohoId)) continue
      clienti.push({ ...cliente, zoho_record_id: zohoId })
    }

    if (data.length < PAGE_SIZE || crmIds) break
  }

  return clienti
}

async function listZohoAttachments({ apiDomain, moduleName, recordId, token }) {
  const attachments = []
  for (let page = 1; ; page++) {
    const url = new URL(
      `/crm/v8/${encodeURIComponent(moduleName)}/${encodeURIComponent(recordId)}/Attachments`,
      apiDomain,
    )
    url.searchParams.set("fields", "id,File_Name,Created_Time,Modified_Time,Size,Parent_Id")
    url.searchParams.set("page", String(page))
    url.searchParams.set("per_page", String(ZOHO_PER_PAGE))

    const payload = await conRetry(`Zoho list ${recordId} pagina ${page}`, () =>
      zohoJson(url, token),
    )
    if (!payload) break // 204: nessun allegato per questo record
    attachments.push(...(payload.data ?? []))
    if (!payload.info?.more_records) break
  }
  return attachments
}

function nomeFileDisponibile(nomeOriginale, dimensione, items) {
  const nomePulito = sanitizeName(nomeOriginale || "allegato")
  const esatto = items.find((item) => !item.isFolder && item.nome === nomePulito)
  if (esatto && dimensione != null && esatto.byte === dimensione) {
    return { nome: nomePulito, skip: true }
  }

  const nomiEsistenti = items.filter((item) => !item.isFolder).map((item) => item.nome)
  const nome = nomeSenzaCollisioni(nomePulito, nomiEsistenti)
  return { nome, skip: false }
}

async function processaCliente({ cliente, apiDomain, moduleName, token, apply }) {
  const attachments = await listZohoAttachments({
    apiDomain,
    moduleName,
    recordId: cliente.zoho_record_id,
    token,
  })
  if (attachments.length === 0) return { cliente, trovati: 0, caricati: 0, saltati: 0, errori: [] }

  const folderPath = folderPathForRecord("cliente", cliente.id, nomeCliente(cliente))
  const listing = await conRetry(`Nextcloud list ${cliente.id}`, async () => {
    const result = await listFolder(folderPath)
    if (!result.ok) {
      const error = new Error(result.error ?? `Nextcloud HTTP ${result.status}`)
      error.status = result.status
      throw error
    }
    return result
  })

  let caricati = 0
  let saltati = 0
  const errori = []
  const items = [...listing.items]

  for (const attachment of attachments) {
    const attachmentId = attachment.id
    const fileName = attachment.File_Name || `allegato-${attachmentId}`
    const size = Number.isFinite(Number(attachment.Size)) ? Number(attachment.Size) : null
    const destinazione = nomeFileDisponibile(fileName, size, items)
    const fullPath = `${folderPath}/${destinazione.nome}`

    if (destinazione.skip) {
      saltati++
      continue
    }

    if (!apply) {
      console.log(`   dry-run: ${nomeCliente(cliente)} -> ${fullPath}`)
      caricati++
      items.push({ nome: destinazione.nome, isFolder: false, byte: size })
      continue
    }

    const url = new URL(
      `/crm/v8/${encodeURIComponent(moduleName)}/${encodeURIComponent(cliente.zoho_record_id)}/Attachments/${encodeURIComponent(attachmentId)}`,
      apiDomain,
    )

    try {
      const file = await conRetry(`Zoho download ${attachmentId}`, () => zohoDownload(url, token))
      const upload = await conRetry(`Nextcloud upload ${cliente.id}/${destinazione.nome}`, async () => {
        const result = await uploadFile(fullPath, file.buffer, file.contentType)
        if (!result.ok) {
          const error = new Error(result.error ?? `Nextcloud HTTP ${result.status}`)
          error.status = result.status
          throw error
        }
        return result
      })
      if (upload.ok) {
        caricati++
        items.push({ nome: destinazione.nome, isFolder: false, byte: file.buffer.length })
      }
    } catch (error) {
      errori.push({
        attachmentId,
        fileName,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { cliente, trovati: attachments.length, caricati, saltati, errori }
}

async function main() {
  const apply = flag("apply")
  const token = process.env.ZOHO_ACCESS_TOKEN ?? process.env.ZOHO_OAUTH_TOKEN
  if (!token) requireEnv("ZOHO_ACCESS_TOKEN")

  const apiDomain = (arg("api-domain") ?? process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.eu").replace(
    /\/+$/,
    "",
  )
  const moduleName = arg("module") ?? process.env.ZOHO_CLIENTI_MODULE ?? "Clienti"
  const concurrency = Math.max(1, Number(arg("concurrency", DEFAULT_CONCURRENCY)) || DEFAULT_CONCURRENCY)
  const limit = Number(arg("limit", "0")) || 0
  const crmIds = csvArg("crm-ids")
  const zohoIds = csvArg("zoho-ids")

  requireEnv("NEXTCLOUD_URL")
  requireEnv("NEXTCLOUD_ADMIN_USER")
  requireEnv("NEXTCLOUD_ADMIN_PASSWORD")
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  let clienti = await fetchClienti(admin, crmIds, zohoIds)
  if (limit > 0) clienti = clienti.slice(0, limit)

  console.log(
    `Clienti con ID Zoho: ${clienti.length} | modulo Zoho: ${moduleName} | domain: ${apiDomain}` +
      (apply ? " | APPLY" : " | DRY RUN"),
  )

  let next = 0
  let clientiConAllegati = 0
  let allegatiTrovati = 0
  let allegatiCaricati = 0
  let allegatiSaltati = 0
  const falliti = []

  async function worker() {
    while (next < clienti.length) {
      const cliente = clienti[next++]
      try {
        const result = await processaCliente({ cliente, apiDomain, moduleName, token, apply })
        if (result.trovati > 0) clientiConAllegati++
        allegatiTrovati += result.trovati
        allegatiCaricati += result.caricati
        allegatiSaltati += result.saltati
        if (result.errori.length > 0) falliti.push({ cliente, errori: result.errori })

        const fatti = clientiConAllegati + falliti.length
        if ((allegatiTrovati > 0 && allegatiTrovati % 50 === 0) || fatti % 25 === 0) {
          console.log(
            `   progress: clienti esaminati ${next}/${clienti.length}, allegati trovati ${allegatiTrovati}, caricati ${allegatiCaricati}, saltati ${allegatiSaltati}`,
          )
        }
      } catch (error) {
        falliti.push({
          cliente,
          errori: [{ message: error instanceof Error ? error.message : String(error) }],
        })
        console.error(`   errore cliente ${cliente.id} / Zoho ${cliente.zoho_record_id}: ${falliti.at(-1).errori[0].message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))

  console.log(
    `\nCompletato: ${clienti.length} clienti esaminati, ${clientiConAllegati} con allegati, ` +
      `${allegatiTrovati} allegati Zoho trovati, ${allegatiCaricati} ${apply ? "caricati" : "da caricare"}, ${allegatiSaltati} gia' presenti.`,
  )

  if (falliti.length > 0) {
    console.log(`Falliti/parziali: ${falliti.length}`)
    for (const item of falliti.slice(0, 20)) {
      console.log(` - CRM ${item.cliente.id} / Zoho ${item.cliente.zoho_record_id} / ${nomeCliente(item.cliente)}`)
      for (const errore of item.errori.slice(0, 3)) {
        console.log(`   ${errore.attachmentId ? `${errore.attachmentId} ` : ""}${errore.fileName ?? ""} ${errore.message}`)
      }
    }
    if (falliti.length > 20) console.log(` - ... altri ${falliti.length - 20}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Errore inatteso:", error instanceof Error ? error.stack : error)
  process.exit(1)
})
