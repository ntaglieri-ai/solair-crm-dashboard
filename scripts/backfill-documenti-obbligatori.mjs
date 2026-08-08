// Backfill una-tantum: crea la sottocartella "Documenti obbligatori" (spec
// FASE 1.3) dentro la cartella Nextcloud di TUTTI i lead gia' esistenti.
// I lead creati da qui in avanti la ricevono automaticamente in
// app/api/leads/route.ts, questo script copre solo lo storico.
//
// Uso:
//   node --env-file=.env.local scripts/backfill-documenti-obbligatori.mjs
//   node --env-file=.env.local scripts/backfill-documenti-obbligatori.mjs --dry-run
//   node --env-file=.env.local scripts/backfill-documenti-obbligatori.mjs --ids=<uuid>,<uuid>
//
// Sicuro da rilanciare quante volte si vuole: ensureFolder fa MKCOL e
// considera 405 ("esiste gia'") un successo, quindi non tocca nulla di
// esistente e non cancella MAI niente.

import { createClient } from "@supabase/supabase-js"
import { registerHooks } from "node:module"

// Le funzioni Nextcloud vivono in TypeScript sotto lib/ e si importano tra
// loro senza estensione ("./config"), forma che Node in ESM non risolve.
// Questo hook aggiunge ".ts" agli import relativi estensionless: cosi' lo
// script riusa ensureFolder/paths REALI dell'app invece di duplicarne la
// logica, che e' l'unico modo di garantire che i path coincidano.
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

const { ensureFolder, listFolder } = await import("../lib/nextcloud/admin-webdav.ts")
const { documentiObbligatoriFolderPath, folderPathForRecord, DOCUMENTI_OBBLIGATORI_FOLDER } =
  await import("../lib/allegati/paths.ts")

const PAGE_SIZE = 500
// Poche richieste in parallelo: ogni ensureFolder fa una MKCOL per segmento
// di path, non vogliamo martellare Nextcloud con migliaia di richieste.
const CONCURRENCY = 4
// Su una passata da ~9k lead qualche richiesta cade per motivi di rete
// ("fetch failed" da undici, tipicamente ECONNRESET/ETIMEDOUT): visto dal
// vivo su 2 lead vicini nell'ordine di elaborazione, quindi una finestra
// sfortunata e non un problema dei dati. Un paio di retry con attesa
// crescente li recupera senza dover rilanciare tutto.
const TENTATIVI = 3
const ATTESA_MS = 800

function attendi(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Riprova un'operazione WebDAV che torna { ok, error }. Ritenta solo gli
 * errori di rete/5xx: un 4xx e' una risposta definitiva del server e
 * rifarla non cambia nulla.
 */
async function conRetry(etichetta, fn) {
  let ultimo
  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    const res = await fn()
    if (res.ok) return res
    ultimo = res
    const ritentabile = res.status === 0 || res.status >= 500
    if (!ritentabile || tentativo === TENTATIVI) break
    console.error(
      `   ↻ ${etichetta}: tentativo ${tentativo}/${TENTATIVI} fallito (${res.error ?? res.status}), riprovo…`,
    )
    await attendi(ATTESA_MS * tentativo)
  }
  return ultimo
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Variabile d'ambiente mancante: ${name}`)
    process.exit(1)
  }
  return v
}

async function fetchAllLeads(admin, soloIds) {
  const leads = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin
      .from("leads")
      .select("id, nome_lead")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    // --ids serve a ripassare solo i lead falliti in una run precedente,
    // senza rifare l'intera passata.
    if (soloIds) query = query.in("id", soloIds)
    const { data, error } = await query
    if (error) {
      console.error("❌ Lettura leads fallita:", error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    leads.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return leads
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const argIds = process.argv.find((a) => a.startsWith("--ids="))
  const soloIds = argIds
    ? argIds
        .slice("--ids=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null
  requireEnv("NEXTCLOUD_URL")
  requireEnv("NEXTCLOUD_ADMIN_USER")
  requireEnv("NEXTCLOUD_ADMIN_PASSWORD")
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const leads = await fetchAllLeads(admin, soloIds)
  console.log(
    `📋 Lead trovati: ${leads.length}` +
      (soloIds ? `  (filtro --ids: ${soloIds.length} richiesti)` : "") +
      (dryRun ? "  (DRY RUN, nessuna scrittura)" : ""),
  )
  if (soloIds && leads.length !== soloIds.length) {
    const mancanti = soloIds.filter((id) => !leads.some((l) => l.id === id))
    console.error(`⚠️  Id non trovati a DB: ${mancanti.join(", ")}`)
  }

  let creati = 0
  let giaPresenti = 0
  const falliti = []
  let next = 0

  async function worker() {
    while (next < leads.length) {
      const lead = leads[next++]
      const nomeLead = lead.nome_lead ?? ""
      const path = documentiObbligatoriFolderPath(lead.id, nomeLead)

      if (dryRun) {
        console.log(`   · ${path}`)
        creati++
        continue
      }

      // Con ~9k lead conviene chiedere prima: ensureFolder fa una MKCOL per
      // OGNI segmento del path (5 richieste), mentre questa PROPFIND ne costa
      // una sola e sui rilanci (caso normale, lo script e' idempotente) evita
      // del tutto le MKCOL. 404 sulla cartella lead = lista vuota = si crea.
      const listing = await conRetry(`PROPFIND ${lead.id}`, () =>
        listFolder(folderPathForRecord("lead", lead.id, nomeLead)),
      )
      if (listing.ok && listing.items.some((i) => i.isFolder && i.nome === DOCUMENTI_OBBLIGATORI_FOLDER)) {
        giaPresenti++
      } else {
        const result = await conRetry(`MKCOL ${lead.id}`, () => ensureFolder(path))
        if (result.ok) {
          creati++
        } else {
          falliti.push({ id: lead.id, path, error: result.error ?? `HTTP ${result.status}` })
          console.error(`   ⚠️  ${lead.id} — ${path}: ${result.error ?? `HTTP ${result.status}`}`)
        }
      }

      const fatti = creati + giaPresenti + falliti.length
      if (fatti % 100 === 0) console.log(`   … ${fatti}/${leads.length}`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log(
    `\n✅ Cartelle pronte: ${creati + giaPresenti}/${leads.length}` +
      ` (create ora: ${creati}, gia' presenti: ${giaPresenti})`,
  )
  if (falliti.length > 0) {
    console.log(`❌ Falliti: ${falliti.length} — rilancia lo script, e' idempotente:`)
    for (const f of falliti.slice(0, 20)) console.log(`   • ${f.id}: ${f.error}`)
    if (falliti.length > 20) console.log(`   … e altri ${falliti.length - 20}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("❌ Errore inatteso:", e instanceof Error ? e.stack : e)
  process.exit(1)
})
