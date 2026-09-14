// backfill-meta-fields.mjs
// Estrae i campi meta_* dal testo libero in leads.descrizione e li scrive nelle colonne dedicate.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backfill-meta-fields.mjs [--dry-run]

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

// "Riferimenti Meta: leadgen 123, page 456, form 789, ad 111, adset 222, campaign 333"
const RIFERIMENTI_RE =
  /Riferimenti Meta:\s*leadgen\s*(\d+),\s*page\s*(\d+),\s*form\s*(\d+),\s*ad\s*(\d+),\s*adset\s*(\d+),\s*campaign\s*(\d+)/g;

// "Campagna: 2026"  (blocco strutturato, maiuscolo)
const CAMPAGNA_RE = /Campagna:\s*([^\n]+)/g;

// "Annuncio: Impianto + wallbox italia"
const ANNUNCIO_RE = /Annuncio:\s*([^\n]+)/g;

// fallback: "(campagna 2026, data click ..., leadgen 123)"
const CAMPAGNA_PAREN_RE = /\(campagna\s+([^,]+),/g;

function lastMatch(regex, text) {
  regex.lastIndex = 0;
  let m, last = null;
  while ((m = regex.exec(text)) !== null) last = m;
  return last;
}

function extract(descrizione) {
  if (!descrizione) return null;

  const rif = lastMatch(RIFERIMENTI_RE, descrizione);
  const campagnaBlock = lastMatch(CAMPAGNA_RE, descrizione);
  const annuncio = lastMatch(ANNUNCIO_RE, descrizione);
  const campagnaParen = lastMatch(CAMPAGNA_PAREN_RE, descrizione);

  const meta_form_id = rif?.[3] ?? null;
  const meta_ad_id = rif?.[4] ?? null;
  const meta_adset_id = rif?.[5] ?? null;
  const meta_campaign_id = rif?.[6] ?? null;

  const meta_campaign_name =
    (campagnaBlock?.[1] ?? campagnaParen?.[1] ?? null)?.trim() || null;
  const meta_ad_name = annuncio?.[1]?.trim() || null;

  if (!meta_campaign_id && !meta_campaign_name && !meta_ad_name) return null;

  return {
    meta_campaign_id,
    meta_campaign_name,
    meta_adset_id,
    meta_adset_name: null, // non presente nel testo libero, resta null
    meta_ad_id,
    meta_ad_name,
    meta_form_id,
  };
}

async function run() {
  let from = 0;
  let totalUpdated = 0;
  let totalScanned = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('leads')
      .select('id, descrizione')
      .is('meta_campaign_id', null)
      .is('meta_campaign_name', null)
      .is('meta_ad_id', null)
      .is('meta_ad_name', null)
      .is('meta_form_id', null) // salta chi ha GIA' un qualsiasi campo meta_* valorizzato (idempotente)
      .not('descrizione', 'is', null)
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    totalScanned += rows.length;

    const updates = [];
    for (const row of rows) {
      const fields = extract(row.descrizione);
      if (fields) updates.push({ id: row.id, ...fields });
    }

    if (updates.length) {
      if (DRY_RUN) {
        console.log(`[dry-run] batch da ${from}: ${updates.length}/${rows.length} aggiornabili`);
        console.log(updates.slice(0, 3));
      } else {
        for (const u of updates) {
          const { id, ...fields } = u;
          const { error: upErr } = await supabase
            .from('leads')
            .update(fields)
            .eq('id', id);
          if (upErr) console.error(`Errore su lead ${id}:`, upErr.message);
        }
        totalUpdated += updates.length;
        console.log(`batch da ${from}: aggiornati ${updates.length}/${rows.length}`);
      }
    }

    from += BATCH_SIZE;
  }

  console.log(`\nFine. Scansionati: ${totalScanned}. Aggiornati: ${DRY_RUN ? '(dry-run, nessuna scrittura)' : totalUpdated}.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
