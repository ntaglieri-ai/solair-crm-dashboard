#!/usr/bin/env node
// Popola le tabelle del layout (crm_layout_pagine / _blocchi / _campi) a
// partire dall'export dei layout Zoho.
//
//   node scripts/migrations/seed-layout-da-zoho.mjs --file layout-clienti.json
//   node scripts/migrations/seed-layout-da-zoho.mjs --file layout-clienti.json --apply
//
// Senza --apply non scrive nulla: stampa cosa farebbe.
//
// Variabili richieste (in .env.local, con --env-file):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// L'export si ottiene da:
//   GET /crm/v8/settings/layouts?module=Contacts
// NON da settings/fields: quello non restituisce le espressioni delle
// formule, l'endpoint layouts si.
//
// Idempotente: rilanciarlo aggiorna quello che c'e' invece di duplicare.

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

/* -------------------------------------------------------------------------
 * Mappatura sezioni Zoho -> pagine del nostro CRM.
 *
 * Le 18 sezioni Zoho non diventano 18 voci di navbar: confluiscono nelle
 * macro-voci concordate, come blocchi al loro interno. L'ordine dei blocchi
 * dentro una pagina segue l'ordine di questo elenco.
 * ---------------------------------------------------------------------- */
const PAGINE_PER_MODULO = {
  clienti: [
    {
      key: "anagrafica",
      label: "Anagrafica",
      sezioni: ["Informazioni Clienti", "Informazioni indirizzo", "Riepilogo Visite"],
    },
    { key: "documenti", label: "Documenti", componente: "allegati", sezioni: [] },
    {
      key: "iter-burocratico",
      label: "Iter burocratico",
      sezioni: ["Pratiche Enel", "GSE", "Dati catastali"],
    },
    {
      key: "impianto",
      label: "Impianto",
      sezioni: ["Informazioni Tecniche FTV", "Zavorre", "Info Tecniche Termico"],
    },
    {
      key: "pagamenti",
      label: "Pagamenti & Note Commerciali",
      sezioni: [
        "Note Commerciale",
        "Dati Amministrativi Fotovoltaico",
        "Dati Amministrativi CT3.0",
        "Provvigioni",
      ],
    },
    {
      key: "logistica",
      label: "Logistica",
      sezioni: ["Stanziamento materiali", "Iter ordinario"],
    },
    { key: "comunicazioni", label: "Comunicazioni", sezioni: ["Servizio clienti"] },
    { key: "note-cliente", label: "Note cliente", componente: "note", sezioni: [] },
    { key: "email", label: "E-mail", componente: "email", sezioni: [] },
    { key: "note-interne", label: "Note interne", componente: "note-interne", sezioni: [] },
    { key: "calendario", label: "Calendario", componente: "calendario", sezioni: [] },
    { key: "attivita", label: "Attività", componente: "attivita", sezioni: [] },
  ],

  // Lead: stessa impostazione dei Clienti — le sezioni Zoho diventano
  // blocchi dentro le voci di navigazione gia' in uso sulla scheda.
  lead: [
    { key: "info", label: "Informazioni principali", sezioni: ["Informazioni Lead"] },
    { key: "indirizzo", label: "Indirizzo", sezioni: ["Informazioni indirizzo"] },
    {
      key: "descrizione",
      label: "Descrizione",
      sezioni: ["Informazioni sulla descrizione"],
    },
    { key: "sopralluogo", label: "Sopralluogo", sezioni: ["Sopralluogo precontrattuale"] },
    { key: "note", label: "Note", componente: "note", sezioni: [] },
    {
      key: "documenti-obbligatori",
      label: "Documenti obbligatori",
      componente: "documenti-obbligatori",
      sezioni: [],
    },
    { key: "allegati", label: "Allegati", componente: "allegati", sezioni: [] },
    {
      key: "attivita-aperte",
      label: "Attività aperte",
      componente: "attivita-aperte",
      sezioni: [],
    },
    {
      key: "attivita-chiuse",
      label: "Attività chiuse",
      componente: "attivita-chiuse",
      sezioni: [],
    },
    { key: "email", label: "E-mail", componente: "email", sezioni: [] },
    { key: "calendario", label: "Calendario", componente: "calendario", sezioni: [] },
    { key: "record", label: "Record collegati", componente: "record-collegati", sezioni: [] },
    { key: "timeline", label: "Sequenza temporale", componente: "timeline", sezioni: [] },
  ],
}

/**
 * Sezioni Zoho deliberatamente escluse.
 *
 * "Immagine Clienti" e "Prova sottomodulo" sono vuote su Zoho; le altre due
 * voci non sono campi dato.
 */
const SEZIONI_IGNORATE = new Set([
  "Immagine Clienti",
  "Immagine Lead",
  "Prova sottomodulo",
  // Sul Lead il tracciamento delle visite non ha corrispondenza nel nostro
  // database: gli otto campi resterebbero sempre vuoti.
  "Riepilogo visite",
])

/**
 * Campi Zoho senza corrispondenza nel nostro CRM, saltati con motivo
 * esplicito invece che in silenzio.
 */
const CAMPI_IGNORATI_PER_MODULO = {
  clienti: {
    "Nome e cognome": "calcolato da Zoho (Nome + Cognome), qui restano separati",
    "Record Status": "campo interno Zoho",
    "Layout installazione": "upload immagine, non un campo dato",
  },
  // Sul Lead il record applicativo ha meno campi: quelli elencati qui non
  // esistono, e includerli lascerebbe in scheda caselle sempre vuote.
  lead: {
    "Nome e cognome": "calcolato da Zoho (Nome + Cognome), qui restano separati",
    "Record Status": "campo interno Zoho",
    "ID record": "identificatore Zoho, non un dato della scheda",
    Locked: "flag interno Zoho",
    "è convertito": "stato interno della conversione, gia' rappresentato altrove",
    "Data/ora convertita": "gestita dal nostro flusso di conversione",
    "Orario del registro delle modifiche": "campo interno Zoho",
    "Ora dell’ultimo arricchimento": "arricchimento dati Zia, non in uso",
    "Stato arricchito": "arricchimento dati Zia, non in uso",
    "Ora  iscrizione annullata": "campo interno Zoho",
    Saluti: "non presente sul record Lead",
    "N. di dipendenti": "non presente sul record Lead",
  },
}


function argomento(nome, predefinito = null) {
  const trovato = process.argv.find((a) => a.startsWith(`--${nome}=`))
  if (trovato) return trovato.slice(nome.length + 3)
  return process.argv.includes(`--${nome}`) ? true : predefinito
}

function richiediEnv(nome) {
  const valore = process.env[nome]
  if (!valore) {
    console.error(`Variabile d'ambiente mancante: ${nome}`)
    process.exit(1)
  }
  return valore
}

/* -------------------------------------------------------------------------
 * Traduzione delle formule.
 *
 * Si tocca SOLO la sintassi dei riferimenti: ${Api_Name} diventa
 * {Etichetta Campo}. Operatori, If() annidati, confronti e costanti restano
 * carattere per carattere come su Zoho. Nessuna semplificazione: quattro
 * formule usano If() con confronti sulla modalita' di pagamento, e alcuni
 * rami tornano zero — e' cosi' che sono state configurate, e vanno replicate
 * cosi'.
 *
 * L'originale Zoho viene conservato accanto alla traduzione: quando un
 * numero non torna si confronta senza dover riaprire Zoho, che nel frattempo
 * potrebbe non esserci piu'.
 * ---------------------------------------------------------------------- */
function traduciFormula(expression, etichettaPerApiName) {
  if (!expression) return null
  const expr = expression.replace(/\$\{([A-Za-z0-9_]+)\}/g, (intero, apiName) => {
    const etichetta = etichettaPerApiName.get(apiName)
    // Riferimento a un campo che non e' nel layout: si lascia il nome API,
    // cosi' resta visibile che va risolto a mano invece di sparire.
    return etichetta ? `{${etichetta}}` : intero
  })
  return { expr, origine_zoho: expression }
}


async function main() {
  const percorso = argomento("file")
  if (typeof percorso !== "string") {
    console.error("Indicare il file: --file=layout-clienti.json")
    process.exit(1)
  }
  const modulo = argomento("modulo", "clienti")
  const PAGINE = PAGINE_PER_MODULO[modulo]
  const CAMPI_IGNORATI = CAMPI_IGNORATI_PER_MODULO[modulo] ?? {}
  if (!PAGINE) {
    console.error(`Nessuna mappatura definita per il modulo "${modulo}"`)
    process.exit(1)
  }
  const applica = argomento("apply", false) === true

  const supabase = createClient(
    richiediEnv("NEXT_PUBLIC_SUPABASE_URL"),
    richiediEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  )

  const esportazione = JSON.parse(readFileSync(percorso, "utf8"))
  const layout = esportazione.layouts?.[0]
  if (!layout) {
    console.error("Nessun layout nel file indicato")
    process.exit(1)
  }

  const sezioni = layout.sections ?? []
  const sezionePerNome = new Map(sezioni.map((s) => [s.display_label, s]))

  // api_name -> etichetta, per tradurre i riferimenti nelle formule.
  const etichettaPerApiName = new Map()
  for (const s of sezioni) {
    for (const f of s.fields ?? []) etichettaPerApiName.set(f.api_name, f.field_label)
  }

  console.log(
    `Modulo: ${modulo} | sezioni nel file: ${sezioni.length} | modalita': ${applica ? "SCRITTURA" : "prova (nessuna scrittura)"}`,
  )
  console.log()

  const nonMappate = sezioni
    .map((s) => s.display_label)
    .filter(
      (nome) =>
        !SEZIONI_IGNORATE.has(nome) && !PAGINE.some((p) => p.sezioni.includes(nome)),
    )
  if (nonMappate.length) {
    console.log("Sezioni Zoho non assegnate a nessuna pagina (saltate):")
    for (const nome of nonMappate) console.log("   -", nome)
    console.log()
  }

  let totalePagine = 0
  let totaleBlocchi = 0
  let totaleCampi = 0
  let totaleFormule = 0
  const saltati = []

  for (const [indicePagina, definizione] of PAGINE.entries()) {
    let paginaId = null

    if (applica) {
      const { data, error } = await supabase
        .from("crm_layout_pagine")
        .upsert(
          {
            modulo,
            page_key: definizione.key,
            label: definizione.label,
            componente: definizione.componente ?? null,
            ordinamento: indicePagina,
          },
          { onConflict: "modulo,page_key" },
        )
        .select("id")
        .single()

      if (error) {
        console.error(`Pagina ${definizione.key}: ${error.message}`)
        process.exit(1)
      }
      paginaId = data.id
    }
    totalePagine += 1

    const blocchi = definizione.sezioni
      .map((nome) => sezionePerNome.get(nome))
      .filter(Boolean)

    console.log(
      `${definizione.label}${definizione.componente ? `  [componente: ${definizione.componente}]` : ""}`,
    )

    for (const [indiceBlocco, sezione] of blocchi.entries()) {
      const campi = (sezione.fields ?? []).filter((f) => !CAMPI_IGNORATI[f.field_label])
      for (const f of sezione.fields ?? []) {
        if (CAMPI_IGNORATI[f.field_label]) {
          saltati.push(`${f.field_label} — ${CAMPI_IGNORATI[f.field_label]}`)
        }
      }

      const blockKey = sezione.display_label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 63)

      let bloccoId = null
      if (applica) {
        const { data, error } = await supabase
          .from("crm_layout_blocchi")
          .upsert(
            {
              pagina_id: paginaId,
              block_key: blockKey,
              label: sezione.display_label,
              colonne: 2,
              ordinamento: indiceBlocco,
            },
            { onConflict: "pagina_id,block_key" },
          )
          .select("id")
          .single()

        if (error) {
          console.error(`Blocco ${blockKey}: ${error.message}`)
          process.exit(1)
        }
        bloccoId = data.id
      }
      totaleBlocchi += 1

      const conFormula = campi.filter((f) => f.data_type === "formula").length
      totaleFormule += conFormula
      console.log(
        `   ${sezione.display_label}: ${campi.length} campi${conFormula ? `, di cui ${conFormula} calcolati` : ""}`,
      )

      for (const [indiceCampo, campo] of campi.entries()) {
        const formula =
          campo.data_type === "formula"
            ? traduciFormula(campo.formula?.expression, etichettaPerApiName)
            : null

        if (applica) {
          const { error } = await supabase.from("crm_layout_campi").upsert(
            {
              blocco_id: bloccoId,
              origine: "system",
              field_key: campo.field_label,
              ordinamento: indiceCampo,
              // Un campo calcolato non e' scrivibile: il valore arriva dalla
              // formula. Su Zoho sono nascosti in creazione e modifica.
              sola_lettura: campo.data_type === "formula",
              formato:
                campo.decimal_place != null ? { decimali: campo.decimal_place } : {},
              formula,
            },
            { onConflict: "blocco_id,origine,field_key" },
          )

          if (error) {
            console.error(`Campo ${campo.field_label}: ${error.message}`)
            process.exit(1)
          }
        }
        totaleCampi += 1
      }
    }
    console.log()
  }

  if (saltati.length) {
    console.log("Campi Zoho saltati:")
    for (const riga of [...new Set(saltati)]) console.log("   -", riga)
    console.log()
  }

  console.log(
    `Completato: ${totalePagine} pagine, ${totaleBlocchi} blocchi, ${totaleCampi} campi (${totaleFormule} con formula).`,
  )
  if (!applica) {
    console.log("Nessuna scrittura effettuata. Rilancia con --apply per applicare.")
  }
}

main().catch((errore) => {
  console.error(errore)
  process.exit(1)
})
