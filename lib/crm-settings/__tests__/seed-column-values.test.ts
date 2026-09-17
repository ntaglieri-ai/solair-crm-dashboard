import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { seedValoriModulo } from "../seed-column-values"

/**
 * Il seed gira una volta sola su dati veri e non e' facile da riprovare: se
 * sbaglia, o duplica valori o li salta in silenzio. Le garanzie che contano
 * sono due — non scrive mai in prova, e non tocca cio' che c'e' gia'.
 */

type RigaEsistente = { column_name: string; value: string }
type RigaFisica = {
  column_name: string
  data_type: string
  is_nullable: string
  ordinal_position: number
}

/**
 * Catena stile PostgREST: eq/is si concatenano e l'oggetto e' attendibile,
 * cosi' `await query.eq(...).is(...)` funziona come nel client vero.
 */
function query(risultato: { data: unknown; error: unknown }) {
  const nodo: Record<string, unknown> = {
    eq: () => nodo,
    is: () => nodo,
    then: (risolvi: (v: unknown) => unknown) => Promise.resolve(risultato).then(risolvi),
  }
  return nodo
}

function clientFinto(
  esistenti: RigaEsistente[],
  opzioni: { fisiche?: RigaFisica[]; tipi?: { column_name: string; tipo: string }[] } = {},
) {
  const inseriti: Record<string, unknown>[][] = []
  const inseritiCustomFields: Record<string, unknown>[] = []
  const aggiornatiCustomFields: Record<string, unknown>[] = []

  const client = {
    rpc: () => Promise.resolve({ data: opzioni.fisiche ?? [], error: null }),
    from: (tabella: string) => {
      if (tabella === "crm_custom_fields") {
        return {
          select: () => query({ data: opzioni.tipi ?? [], error: null }),
          insert: (riga: Record<string, unknown>) => {
            inseritiCustomFields.push(riga)
            return Promise.resolve({ error: null })
          },
          update: (riga: Record<string, unknown>) => {
            aggiornatiCustomFields.push(riga)
            return query({ data: null, error: null })
          },
        }
      }
      return {
        select: () => query({ data: esistenti, error: null }),
        insert: (righe: Record<string, unknown>[]) => {
          inseriti.push(righe)
          return Promise.resolve({ error: null })
        },
      }
    },
  } as unknown as SupabaseClient

  return { client, inseriti, inseritiCustomFields, aggiornatiCustomFields }
}

describe("seedValoriModulo", () => {
  it("in prova non scrive niente ma dice cosa scriverebbe", async () => {
    const { client, inseriti } = clientFinto([])
    const esito = await seedValoriModulo(client, "Compiti", { apply: false })

    expect(inseriti).toHaveLength(0)
    expect(esito.tabella).toBe("compiti")
    expect(esito.creati.length).toBeGreaterThan(0)
    // Gli stati dei compiti sono fra i valori scritti nel codice.
    expect(esito.creati.map((v) => v.etichetta)).toContain("Non iniziato")
  })

  it("scrive solo con apply, con chiave normalizzata e ordine conservato", async () => {
    const { client, inseriti } = clientFinto([])
    await seedValoriModulo(client, "Compiti", { apply: true })

    expect(inseriti).toHaveLength(1)
    const righe = inseriti[0] as { column_name: string; value: string; sort_order: number }[]
    const priorita = righe.filter((riga) => riga.column_name === "priorita")

    expect(priorita.map((riga) => riga.value)).toEqual(["alto", "medio", "basso"])
    // L'ordine e' quello in cui i valori sono sempre comparsi nelle tendine.
    expect(priorita.map((riga) => riga.sort_order)).toEqual([0, 1, 2])
  })

  it("non ricrea i valori gia' presenti a database", async () => {
    const { client, inseriti } = clientFinto([
      { column_name: "priorita", value: "alto" },
      { column_name: "priorita", value: "medio" },
    ])
    const esito = await seedValoriModulo(client, "Compiti", { apply: true })

    expect(esito.gia_presenti).toBe(2)
    const righe = inseriti[0] as { column_name: string; value: string }[]
    const priorita = righe.filter((riga) => riga.column_name === "priorita")
    expect(priorita.map((riga) => riga.value)).toEqual(["basso"])
  })

  it("non tocca un modulo senza valori definiti nel codice", async () => {
    const { client, inseriti } = clientFinto([])
    const esito = await seedValoriModulo(client, "Scadenze", { apply: true })

    expect(esito.creati).toHaveLength(0)
    expect(inseriti).toHaveLength(0)
  })

  it("rifiuta un modulo che non e' un modulo CRM", async () => {
    const { client } = clientFinto([])
    await expect(
      // @ts-expect-error: il chiamante reale e' tipizzato, questo verifica la rete di sicurezza.
      seedValoriModulo(client, "Inesistente", { apply: true }),
    ).rejects.toThrow(/Modulo CRM non valido/)
  })

  it("propaga un errore di lettura invece di seminare a vuoto", async () => {
    const client = {
      rpc: vi.fn(),
      from: () => ({
        select: () => query({ data: null, error: { message: "boom" } }),
        insert: vi.fn(),
      }),
    } as unknown as SupabaseClient

    await expect(seedValoriModulo(client, "Compiti", { apply: true })).rejects.toThrow(
      /Lettura valori compiti: boom/,
    )
  })
})

/**
 * L'allineamento dei tipi e' il passaggio che rende visibile l'editor dei
 * valori: senza, una tendina resta tipizzata "Linea singola" perche' in
 * Postgres e' `text` come qualsiasi altro testo, e le sue opzioni — pur
 * essendoci — non compaiono da nessuna parte.
 */
describe("allineamento dei tipi tendina", () => {
  const fisiche: RigaFisica[] = [
    { column_name: "stato", data_type: "text", is_nullable: "NO", ordinal_position: 3 },
    { column_name: "priorita", data_type: "text", is_nullable: "YES", ordinal_position: 4 },
    { column_name: "sede", data_type: "text[]", is_nullable: "YES", ordinal_position: 5 },
  ]

  it("marca come tendina le colonne testuali che hanno valori", async () => {
    const { client, inseritiCustomFields } = clientFinto([], { fisiche, tipi: [] })
    const esito = await seedValoriModulo(client, "Compiti", { apply: true })

    expect(esito.tipi_allineati).toEqual([
      { colonna: "stato", tipo: "select" },
      { colonna: "priorita", tipo: "select" },
      { colonna: "sede", tipo: "multiselect" },
    ])
    expect(inseritiCustomFields).toHaveLength(3)
  })

  it("aggiorna il solo tipo quando la riga esiste, senza toccare l'etichetta", async () => {
    // Un admin che ha rinominato il campo non deve vederselo tornare al nome
    // della colonna solo perche' e' passato il seed.
    const { client, aggiornatiCustomFields, inseritiCustomFields } = clientFinto([], {
      fisiche,
      tipi: [{ column_name: "stato", tipo: "text" }],
    })
    await seedValoriModulo(client, "Compiti", { apply: true })

    expect(aggiornatiCustomFields).toEqual([
      expect.objectContaining({ tipo: "select" }),
    ])
    expect(aggiornatiCustomFields[0]).not.toHaveProperty("label")
    expect(inseritiCustomFields.map((r) => r.column_name)).toEqual(["priorita", "sede"])
  })

  it("rispetta un tipo gia' scelto da un amministratore", async () => {
    const { client, aggiornatiCustomFields, inseritiCustomFields } = clientFinto([], {
      fisiche,
      tipi: [{ column_name: "stato", tipo: "textarea" }],
    })
    const esito = await seedValoriModulo(client, "Compiti", { apply: true })

    expect(esito.tipi_allineati.map((t) => t.colonna)).not.toContain("stato")
    expect(aggiornatiCustomFields).toHaveLength(0)
    expect(inseritiCustomFields.map((r) => r.column_name)).toEqual(["priorita", "sede"])
  })

  it("in prova non scrive i tipi ma li elenca", async () => {
    const { client, inseritiCustomFields, aggiornatiCustomFields } = clientFinto([], {
      fisiche,
      tipi: [],
    })
    const esito = await seedValoriModulo(client, "Compiti", { apply: false })

    expect(esito.tipi_allineati).toHaveLength(3)
    expect(inseritiCustomFields).toHaveLength(0)
    expect(aggiornatiCustomFields).toHaveLength(0)
  })
})
