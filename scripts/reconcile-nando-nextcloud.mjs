// Riconciliazione manuale una-tantum: l'account Superadmin di Nando ha gia' un
// account Nextcloud pre-esistente (lo stesso account "admin" usato per il
// provisioning). Il flusso automatico si rifiuta correttamente di toccarlo
// ("account gia' esistente, riconciliazione manuale necessaria"), quindi qui
// coniamo a mano una app-password per quell'account e la salviamo cifrata,
// legata all'utente_id di Nando.
//
// Uso:
//   node --env-file=.env.local scripts/reconcile-nando-nextcloud.mjs
//
// NON e' un endpoint ne' una feature ripetibile: e' un fix una-tantum per
// questo singolo account. Il flusso invite/SMTP dei nuovi assunti resta
// intatto e separato.

import { createClient } from "@supabase/supabase-js"

const NANDO_EMAIL = "n.taglieri@gmail.com"

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Variabile d'ambiente mancante: ${name}`)
    process.exit(1)
  }
  return v
}

function basicAuth(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
}

function ocsHeaders(extra) {
  return { "OCS-APIRequest": "true", Accept: "application/json", ...extra }
}

function isOcsOk(meta) {
  return meta.statuscode === 100 || meta.statuscode === 200
}

async function parseOcs(res) {
  const text = await res.text()
  try {
    const json = JSON.parse(text)
    return {
      meta: json.ocs?.meta ?? { status: "failure", statuscode: res.status, message: text.slice(0, 200) },
      data: json.ocs?.data ?? null,
    }
  } catch {
    return {
      meta: { status: "failure", statuscode: res.status, message: text.slice(0, 200) || res.statusText },
      data: null,
    }
  }
}

// Conia una app-password revocabile autenticandosi COME l'account admin
// (basic auth NEXTCLOUD_ADMIN_USER:NEXTCLOUD_ADMIN_PASSWORD). Stessa tecnica
// OCS core/getapppassword usata in lib/nextcloud/provisioning.ts.
async function mintAppPassword(baseUrl, user, password) {
  const res = await fetch(`${baseUrl}/ocs/v2.php/core/getapppassword?format=json`, {
    headers: ocsHeaders({ Authorization: basicAuth(user, password) }),
  })
  const { meta, data } = await parseOcs(res)
  if (!isOcsOk(meta)) {
    throw new Error(`getapppassword fallito (OCS ${meta.statuscode}: ${meta.message})`)
  }
  const apppassword = data?.apppassword
  if (!apppassword) throw new Error("Risposta OCS senza apppassword")
  return apppassword
}

// Verifica live che la app-password funzioni: PROPFIND Depth:1 sulla root
// files dell'account. Ritorna la lista dei nomi di primo livello.
async function listRootFolder(baseUrl, username, appPassword) {
  const url = `${baseUrl}/remote.php/dav/files/${encodeURIComponent(username)}`
  const body = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>`
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: basicAuth(username, appPassword),
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body,
  })
  if (res.status !== 207) {
    throw new Error(`PROPFIND fallito (HTTP ${res.status})`)
  }
  const xml = await res.text()
  const marker = `/remote.php/dav/files/${username}`
  const hrefs = [...xml.matchAll(/<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/gi)]
    .map((m) => {
      let h = m[1].trim()
      try {
        h = decodeURIComponent(h)
      } catch {
        /* gia' decodificato */
      }
      const idx = h.indexOf(marker)
      return idx >= 0 ? h.slice(idx + marker.length).replace(/^\/+|\/+$/g, "") : ""
    })
    .filter((p) => p !== "")
  return hrefs
}

async function main() {
  const baseUrl = requireEnv("NEXTCLOUD_URL").replace(/\/+$/, "")
  const adminUser = requireEnv("NEXTCLOUD_ADMIN_USER")
  const adminPassword = requireEnv("NEXTCLOUD_ADMIN_PASSWORD")
  const encKey = requireEnv("NEXTCLOUD_CRED_ENC_KEY")
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // 1. Trova l'utente_id di Nando dalla sua email.
  const { data: utente, error: utenteErr } = await admin
    .from("utenti")
    .select("id, nome, email")
    .eq("email", NANDO_EMAIL)
    .single()
  if (utenteErr || !utente) {
    console.error(`❌ Utente ${NANDO_EMAIL} non trovato:`, utenteErr?.message)
    process.exit(1)
  }
  console.log(`👤 Utente: ${utente.nome} <${utente.email}>  id=${utente.id}`)
  console.log(`🔗 Account Nextcloud (nc_username): ${adminUser}`)

  // 2. Conia una app-password fresca per l'account admin.
  const appPassword = await mintAppPassword(baseUrl, adminUser, adminPassword)
  console.log(`🔑 App-password coniata (len=${appPassword.length}).`)

  // 3. Salva cifrata via RPC, legata all'utente_id di Nando.
  const { error: upsertErr } = await admin.rpc("nextcloud_cred_upsert", {
    p_utente_id: utente.id,
    p_username: adminUser,
    p_app_password: appPassword,
    p_key: encKey,
    p_status: "active",
    p_last_error: null,
  })
  if (upsertErr) {
    console.error("❌ nextcloud_cred_upsert fallito:", upsertErr.message)
    process.exit(1)
  }
  console.log("💾 Credenziale salvata (cifrata) via nextcloud_cred_upsert.")

  // 4a. Verifica DB: riga attiva con password cifrata presente.
  const { data: row, error: rowErr } = await admin
    .from("nextcloud_credentials")
    .select("utente_id, nc_username, status, app_password_enc, updated_at")
    .eq("utente_id", utente.id)
    .single()
  if (rowErr || !row) {
    console.error("❌ Verifica DB fallita:", rowErr?.message)
    process.exit(1)
  }
  const hasPassword = row.app_password_enc != null
  console.log("\n📋 Verifica DB nextcloud_credentials:")
  console.log(`   nc_username        = ${row.nc_username}`)
  console.log(`   status             = ${row.status}`)
  console.log(`   app_password_enc   = ${hasPassword ? "SET" : "NULL"}`)
  console.log(`   updated_at         = ${row.updated_at}`)
  if (row.status !== "active" || !hasPassword) {
    console.error("❌ Stato inatteso: la riga non è active con password.")
    process.exit(1)
  }

  // 4b. Verifica live: la app-password appena coniata legge davvero le cartelle
  // via WebDAV (stesso path dati usato dalla pagina Documenti).
  console.log("\n🌐 Verifica live WebDAV (PROPFIND root files)...")
  try {
    const entries = await listRootFolder(baseUrl, adminUser, appPassword)
    console.log(`   ✅ PROPFIND 207 OK — ${entries.length} elementi di primo livello:`)
    for (const name of entries.slice(0, 20)) console.log(`      • ${name}`)
    if (entries.length > 20) console.log(`      … e altri ${entries.length - 20}`)
  } catch (e) {
    console.error("   ⚠️  WebDAV di verifica fallito:", e instanceof Error ? e.message : e)
    process.exit(1)
  }

  console.log("\n✅ Riconciliazione completata: la pagina Documenti userà questa app-password per l'account di Nando.")
}

main().catch((e) => {
  console.error("❌ Errore inatteso:", e instanceof Error ? e.stack : e)
  process.exit(1)
})
