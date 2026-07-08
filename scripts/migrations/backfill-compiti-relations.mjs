// Backfill relazioni Compiti: correlato_id/correlato_tipo da leads/clienti e
// proprietario_id da utenti, confrontando gli id Zoho normalizzati (i compiti
// importati hanno il prefisso "zcrm_", le altre tabelle no).
// Idempotente: tocca solo righe con correlato_id/proprietario_id ancora null.
// Uso: node --env-file=.env.local scripts/migrations/backfill-compiti-relations.mjs [--apply]
import process from "node:process"
import { createClient } from "@supabase/supabase-js"

const apply = process.argv.includes("--apply")

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

async function fetchAll(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

// UPDATE per riga (l'upsert richiederebbe le colonne NOT NULL come "oggetto"),
// con un piccolo pool di richieste parallele.
async function updateRows(rows, label) {
  const concurrency = 10
  let index = 0
  let done = 0
  async function worker() {
    while (index < rows.length) {
      const { id, ...patch } = rows[index]
      index += 1
      const { error } = await supabase.from("compiti").update(patch).eq("id", id)
      if (error) throw new Error(`${label} (${id}): ${error.message}`)
      done += 1
      if (done % 250 === 0 || done === rows.length) {
        process.stdout.write(`${label}: ${done}/${rows.length}\r`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  if (rows.length > 0) process.stdout.write("\n")
}

const [compiti, leads, clienti, utenti] = await Promise.all([
  fetchAll(
    "compiti",
    "id,correlato_id,correlato_zoho_id,correlato_nome,proprietario_id,proprietario_zoho_id",
  ),
  fetchAll("leads", "id,zoho_id,nome_lead,nome,cognome"),
  fetchAll("clienti", "id,zoho_record_id,nome_clienti,nome,cognome"),
  fetchAll("utenti", "id,zoho_id"),
])

function personName(row, primary) {
  return (
    row[primary] ??
    [row.nome, row.cognome].filter(Boolean).join(" ").trim() ??
    null
  )
}

const leadByZoho = new Map(
  leads
    .filter((l) => l.zoho_id)
    .map((l) => [
      normalizeZohoId(l.zoho_id),
      { id: l.id, nome: personName(l, "nome_lead") || null },
    ]),
)
const clienteByZoho = new Map(
  clienti
    .filter((c) => c.zoho_record_id)
    .map((c) => [
      normalizeZohoId(c.zoho_record_id),
      { id: c.id, nome: personName(c, "nome_clienti") || null },
    ]),
)
const utenteByZoho = new Map(
  utenti
    .filter((u) => u.zoho_id)
    .map((u) => [normalizeZohoId(u.zoho_id), u.id]),
)

const correlatoUpdates = []
let resolvedAsLead = 0
let resolvedAsCliente = 0
let ambiguous = 0
let unresolvedCorrelati = 0

for (const row of compiti) {
  if (row.correlato_id !== null || !row.correlato_zoho_id) continue
  const zohoId = normalizeZohoId(row.correlato_zoho_id)
  const lead = leadByZoho.get(zohoId)
  const cliente = clienteByZoho.get(zohoId)
  if (lead && cliente) {
    // Id Zoho presente in entrambe le tabelle: non scegliere alla cieca.
    ambiguous += 1
    continue
  }
  const match = lead ?? cliente
  if (!match) {
    unresolvedCorrelati += 1
    continue
  }
  if (lead) resolvedAsLead += 1
  else resolvedAsCliente += 1
  correlatoUpdates.push({
    id: row.id,
    correlato_id: match.id,
    correlato_tipo: lead ? "lead" : "cliente",
    correlato_nome: row.correlato_nome ?? match.nome,
  })
}

const ownerUpdates = compiti
  .filter(
    (row) =>
      row.proprietario_id === null &&
      row.proprietario_zoho_id &&
      utenteByZoho.has(normalizeZohoId(row.proprietario_zoho_id)),
  )
  .map((row) => ({
    id: row.id,
    proprietario_id: utenteByZoho.get(normalizeZohoId(row.proprietario_zoho_id)),
  }))

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      compiti: compiti.length,
      risoltiComeLead: resolvedAsLead,
      risoltiComeCliente: resolvedAsCliente,
      ambigui_saltati: ambiguous,
      // Attesi finché la migrazione Clienti non è completa — non è un errore.
      correlatiNonRisolti: unresolvedCorrelati,
      proprietariDaRisolvere: ownerUpdates.length,
    },
    null,
    2,
  ),
)

if (!apply) {
  console.log("Dry-run completato. Rilanciare con --apply per scrivere.")
  process.exit(0)
}

await updateRows(correlatoUpdates, "backfill correlati")
await updateRows(ownerUpdates, "backfill proprietari")

console.log(
  JSON.stringify(
    {
      correlatiAggiornati: correlatoUpdates.length,
      proprietariAggiornati: ownerUpdates.length,
    },
    null,
    2,
  ),
)
