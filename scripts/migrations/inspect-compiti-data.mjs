// Ispezione dati Compiti (sola lettura): stati, relazioni correlato, proprietari.
// Uso: node --env-file=.env.local scripts/migrations/inspect-compiti-data.mjs
import process from "node:process"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// I compiti importati da Zoho hanno id con prefisso "zcrm_", mentre
// leads/clienti/utenti li salvano già normalizzati (vedi import-zoho-leads.mjs).
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

const [compiti, leads, clienti, utenti] = await Promise.all([
  fetchAll(
    "compiti",
    "id,stato,correlato_id,correlato_zoho_id,correlato_tipo,correlato_nome,proprietario_id,proprietario_zoho_id",
  ),
  fetchAll("leads", "id,zoho_id"),
  fetchAll("clienti", "id,zoho_record_id"),
  fetchAll("utenti", "id,zoho_id"),
])

// a. Stati distinti con conteggi
const statoCounts = new Map()
for (const row of compiti) {
  const key = row.stato === null ? "(null)" : row.stato
  statoCounts.set(key, (statoCounts.get(key) ?? 0) + 1)
}

// b. Relazioni correlato — confronto su id normalizzati (senza prefisso zcrm_).
const leadIdsByZoho = new Set(
  leads.filter((l) => l.zoho_id).map((l) => normalizeZohoId(l.zoho_id)),
)
const clientiIdsByZoho = new Set(
  clienti
    .filter((c) => c.zoho_record_id)
    .map((c) => normalizeZohoId(c.zoho_record_id)),
)
const withZoho = compiti.filter((c) => c.correlato_zoho_id)
const withZohoPrefixed = withZoho.filter((c) =>
  String(c.correlato_zoho_id).startsWith("zcrm_"),
)
const alreadyResolved = compiti.filter((c) => c.correlato_id !== null)
const unresolvedWithZoho = withZoho.filter((c) => c.correlato_id === null)
const resolvableAsLead = unresolvedWithZoho.filter((c) =>
  leadIdsByZoho.has(normalizeZohoId(c.correlato_zoho_id)),
)
const resolvableAsCliente = unresolvedWithZoho.filter((c) =>
  clientiIdsByZoho.has(normalizeZohoId(c.correlato_zoho_id)),
)
const resolvableBoth = unresolvedWithZoho.filter(
  (c) =>
    leadIdsByZoho.has(normalizeZohoId(c.correlato_zoho_id)) &&
    clientiIdsByZoho.has(normalizeZohoId(c.correlato_zoho_id)),
)
const unresolvable = unresolvedWithZoho.filter(
  (c) =>
    !leadIdsByZoho.has(normalizeZohoId(c.correlato_zoho_id)) &&
    !clientiIdsByZoho.has(normalizeZohoId(c.correlato_zoho_id)),
)

// c. Proprietari — stesso confronto normalizzato.
const utentiByZoho = new Set(
  utenti.filter((u) => u.zoho_id).map((u) => normalizeZohoId(u.zoho_id)),
)
const distinctOwners = new Set(
  compiti.filter((c) => c.proprietario_zoho_id).map((c) => c.proprietario_zoho_id),
)
const matchedOwners = [...distinctOwners].filter((id) =>
  utentiByZoho.has(normalizeZohoId(id)),
)
const compitiOwnerResolvable = compiti.filter(
  (c) =>
    c.proprietario_id === null &&
    c.proprietario_zoho_id &&
    utentiByZoho.has(normalizeZohoId(c.proprietario_zoho_id)),
)

console.log(
  JSON.stringify(
    {
      totals: {
        compiti: compiti.length,
        leads: leads.length,
        clienti: clienti.length,
        utenti: utenti.length,
      },
      a_statiDistinti: Object.fromEntries(
        [...statoCounts.entries()].sort((x, y) => y[1] - x[1]),
      ),
      b_correlati: {
        conCorrelatoZohoId: withZoho.length,
        conPrefissoZcrm: withZohoPrefixed.length,
        giaRisolti_correlatoIdNotNull: alreadyResolved.length,
        daRisolvere: unresolvedWithZoho.length,
        risolvibiliComeLead: resolvableAsLead.length,
        risolvibiliComeCliente: resolvableAsCliente.length,
        ambigui_leadECliente: resolvableBoth.length,
        nonRisolvibili: unresolvable.length,
      },
      c_proprietari: {
        zohoIdDistinti: distinctOwners.size,
        distintiConMatchUtenti: matchedOwners.length,
        distintiSenzaMatch: [...distinctOwners].filter(
          (id) => !utentiByZoho.has(normalizeZohoId(id)),
        ),
        compitiConProprietarioIdNull_risolvibili: compitiOwnerResolvable.length,
        compitiConProprietarioIdGiaRisolto: compiti.filter(
          (c) => c.proprietario_id !== null,
        ).length,
      },
    },
    null,
    2,
  ),
)
