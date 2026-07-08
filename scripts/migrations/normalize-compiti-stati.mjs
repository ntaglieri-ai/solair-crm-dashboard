// Normalizza compiti.stato sul set canonico usato da UI e kanban.
// Idempotente: i valori già canonici non vengono toccati.
// Uso: node --env-file=.env.local scripts/migrations/normalize-compiti-stati.mjs [--apply]
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

// Chiave: valore lowercased+trimmed → stato canonico.
const STATO_CANONICO = new Map([
  ["non iniziato", "Non iniziato"],
  ["da fare", "Non iniziato"],
  ["in corso", "In corso"],
  ["rinviato", "Rinviato"],
  ["differito", "Rinviato"],
  ["posticipato", "Rinviato"],
  ["in attesa di input", "In attesa di input"],
  ["in attesa", "In attesa di input"],
  ["completato", "Completato"],
  ["completata", "Completato"],
])

async function fetchStatoCounts() {
  const counts = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("compiti")
      .select("stato")
      .range(from, from + 999)
    if (error) throw new Error(`compiti: ${error.message}`)
    for (const row of data ?? []) {
      const key = row.stato === null ? "(null)" : row.stato
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    if (!data || data.length < 1000) break
  }
  return counts
}

const before = await fetchStatoCounts()

const updates = [] // [valore grezzo, canonico]
const unknown = [] // valori non coperti dalla mappa: NON toccati
for (const rawValue of before.keys()) {
  if (rawValue === "(null)") continue
  const canonical = STATO_CANONICO.get(rawValue.trim().toLowerCase())
  if (!canonical) {
    unknown.push(rawValue)
  } else if (canonical !== rawValue) {
    updates.push([rawValue, canonical])
  }
}

console.log("Modalità:", apply ? "apply" : "dry-run")
console.log("\nConteggi PRIMA:")
for (const [value, count] of [...before.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${JSON.stringify(value)}: ${count}`)
}

if (unknown.length > 0) {
  console.log(
    "\nATTENZIONE — valori stato non coperti dalla mappa (lasciati invariati):",
  )
  for (const value of unknown) {
    console.log(`  ${JSON.stringify(value)} (${before.get(value)} compiti)`)
  }
}

if (updates.length === 0) {
  console.log("\nNessun valore da normalizzare.")
} else {
  console.log("\nAggiornamenti previsti:")
  for (const [from, to] of updates) {
    console.log(`  ${JSON.stringify(from)} → ${JSON.stringify(to)} (${before.get(from)} compiti)`)
  }
}

if (!apply) {
  console.log("\nDry-run completato. Rilanciare con --apply per scrivere.")
  process.exit(0)
}

for (const [from, to] of updates) {
  const { error } = await supabase
    .from("compiti")
    .update({ stato: to })
    .eq("stato", from)
  if (error) throw new Error(`update stato ${from} → ${to}: ${error.message}`)
}

const after = await fetchStatoCounts()
console.log("\nConteggi DOPO:")
for (const [value, count] of [...after.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${JSON.stringify(value)}: ${count}`)
}
