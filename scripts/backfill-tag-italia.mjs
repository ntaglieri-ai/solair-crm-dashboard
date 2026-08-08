// Backfill una-tantum: applica il tag "Italia" (spec FASE 2, punto 2.3) a
// TUTTI i clienti gia' esistenti che hanno una provincia postale non siciliana
// e non hanno ancora il tag. I clienti creati o modificati da qui in avanti lo
// ricevono automaticamente da lib/clienti/tag-italia.ts (agganciato a
// createClienteRecord / updateClienteRecord): questo script copre solo lo
// storico.
//
// Uso:
//   node --env-file=.env.local scripts/backfill-tag-italia.mjs --dry-run
//   node --env-file=.env.local scripts/backfill-tag-italia.mjs
//
// Lancia SEMPRE prima con --dry-run: stampa quanti clienti verrebbero taggati
// e la distribuzione delle province coinvolte, cosi' si vedono in anticipo i
// valori scritti male (la regola tagga qualsiasi provincia non siciliana,
// anche "Estero" o un refuso) senza aver ancora scritto niente.
//
// Sicuro da rilanciare quante volte si vuole: l'assegnazione e' un upsert con
// ignoreDuplicates su (cliente_id, tag_id), quindi non duplica nulla, non
// tocca le assegnazioni gia' presenti e non cancella MAI niente.

import { createClient } from "@supabase/supabase-js"
import { registerHooks } from "node:module"

const RADICE = new URL("../", import.meta.url)

// La regola vive in TypeScript sotto lib/ e importa "@/lib/..." (alias di
// tsconfig) senza estensione: due forme che Node in ESM non risolve. Questo
// hook riporta l'alias al path reale e aggiunge ".ts", cosi' lo script riusa
// la funzione REALE dell'app invece di riscriversi la lista delle sigle —
// l'unico modo di garantire che backfill e runtime taggino gli stessi clienti.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const spec = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), RADICE).href
      : specifier
    if ((spec.startsWith(".") || spec.startsWith("file:")) && !/\.[cm]?[jt]sx?$/.test(spec)) {
      try {
        return nextResolve(`${spec}.ts`, context)
      } catch {
        /* non e' un modulo TS: si prosegue con la risoluzione normale */
      }
    }
    return nextResolve(spec, context)
  },
})

const { richiedeTagItalia, TAG_ITALIA_NOME, TAG_ITALIA_COLORE } = await import(
  "../lib/clienti/tag-italia-regola.ts"
)

const PAGE_SIZE = 1000
// Insert a blocchi: una sola richiesta per blocco invece di una per cliente.
const BATCH_SIZE = 500

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Variabile d'ambiente mancante: ${name}`)
    process.exit(1)
  }
  return v
}

/** Legge una tabella a pagine finche' non finisce. Ordine per id: stabile. */
async function leggiTutto(admin, tabella, colonne, applicaFiltri = (q) => q) {
  const righe = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applicaFiltri(
      admin.from(tabella).select(colonne).order("id", { ascending: true }),
    ).range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`❌ Lettura ${tabella} fallita:`, error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    righe.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return righe
}

/** Distribuzione delle province da taggare, dalla piu' frequente. */
function distribuzioneProvince(clienti) {
  const conteggi = new Map()
  for (const c of clienti) {
    const provincia = (c.provincia_indirizzo_postale ?? "").trim().toUpperCase()
    conteggi.set(provincia, (conteggi.get(provincia) ?? 0) + 1)
  }
  return [...conteggi.entries()].sort((a, b) => b[1] - a[1])
}

async function trovaTagItalia(admin) {
  // limit(1) e non maybeSingle(): se esistessero sia "Italia" che "italia"
  // creati a mano, maybeSingle() darebbe errore invece di riusarne uno.
  const { data, error } = await admin
    .from("tag")
    .select("id")
    .eq("modulo", "cliente")
    .ilike("nome", TAG_ITALIA_NOME)
    .limit(1)
  if (error) {
    console.error(`❌ Lettura tag "${TAG_ITALIA_NOME}" fallita:`, error.message)
    process.exit(1)
  }
  return data?.[0]?.id ?? null
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const clienti = await leggiTutto(
    admin,
    "clienti",
    "id, nome_clienti, provincia_indirizzo_postale",
  )
  const daTaggare = clienti.filter((c) => richiedeTagItalia(c.provincia_indirizzo_postale))
  console.log(
    `📋 Clienti letti: ${clienti.length} — fuori Sicilia: ${daTaggare.length}` +
      (dryRun ? "  (DRY RUN, nessuna scrittura)" : ""),
  )

  if (daTaggare.length === 0) {
    console.log("✅ Nessun cliente da taggare.")
    return
  }

  console.log("\n🗺️  Province che riceveranno il tag:")
  for (const [provincia, quante] of distribuzioneProvince(daTaggare)) {
    console.log(`   ${String(quante).padStart(5)} × ${provincia}`)
  }

  const tagId = await trovaTagItalia(admin)
  if (!tagId && dryRun) {
    // Niente creazione in dry-run: --dry-run non deve scrivere nulla, nemmeno
    // il tag. Il conteggio dei mancanti e' comunque esatto (senza tag non
    // esiste alcuna assegnazione).
    console.log(
      `\n🏷️  Il tag "${TAG_ITALIA_NOME}" (modulo cliente) non esiste: verrebbe creato ora.`,
    )
    console.log(`\n✅ DRY RUN — da assegnare: ${daTaggare.length}, gia' presenti: 0`)
    return
  }

  let tagIdEffettivo = tagId
  if (!tagIdEffettivo) {
    const creato = await admin
      .from("tag")
      .insert({ nome: TAG_ITALIA_NOME, colore: TAG_ITALIA_COLORE, modulo: "cliente" })
      .select("id")
      .single()
    if (creato.error) {
      console.error(`❌ Creazione tag "${TAG_ITALIA_NOME}" fallita:`, creato.error.message)
      process.exit(1)
    }
    tagIdEffettivo = creato.data.id
    console.log(`\n🏷️  Tag "${TAG_ITALIA_NOME}" creato (${tagIdEffettivo}).`)
  }

  // Chi ce l'ha gia': una sola lettura di cliente_tags filtrata sul tag,
  // invece di una verifica per cliente.
  const assegnazioni = await leggiTutto(admin, "cliente_tags", "cliente_id", (q) =>
    q.eq("tag_id", tagIdEffettivo),
  )
  const giaTaggati = new Set(assegnazioni.map((a) => a.cliente_id))
  const mancanti = daTaggare.filter((c) => !giaTaggati.has(c.id))
  console.log(
    `\n🔎 Da assegnare: ${mancanti.length} — gia' presenti: ${daTaggare.length - mancanti.length}`,
  )

  if (dryRun) {
    for (const c of mancanti.slice(0, 20)) {
      console.log(`   · ${c.id} — ${c.nome_clienti ?? "(senza nome)"} [${c.provincia_indirizzo_postale}]`)
    }
    if (mancanti.length > 20) console.log(`   … e altri ${mancanti.length - 20}`)
    console.log("\n✅ DRY RUN completato, nessuna scrittura eseguita.")
    return
  }

  let inseriti = 0
  const falliti = []
  for (let i = 0; i < mancanti.length; i += BATCH_SIZE) {
    const blocco = mancanti.slice(i, i + BATCH_SIZE)
    const { error } = await admin.from("cliente_tags").upsert(
      blocco.map((c) => ({ cliente_id: c.id, tag_id: tagIdEffettivo })),
      { onConflict: "cliente_id,tag_id", ignoreDuplicates: true },
    )
    if (error) {
      falliti.push({ da: i, quanti: blocco.length, error: error.message })
      console.error(`   ⚠️  Blocco ${i}-${i + blocco.length - 1}: ${error.message}`)
    } else {
      inseriti += blocco.length
      console.log(`   … ${inseriti}/${mancanti.length}`)
    }
  }

  console.log(`\n✅ Tag assegnato a ${inseriti}/${mancanti.length} clienti.`)
  if (falliti.length > 0) {
    console.log(`❌ Blocchi falliti: ${falliti.length} — rilancia lo script, e' idempotente:`)
    for (const f of falliti) console.log(`   • da ${f.da} (${f.quanti} clienti): ${f.error}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("❌ Errore inatteso:", e instanceof Error ? e.stack : e)
  process.exit(1)
})
