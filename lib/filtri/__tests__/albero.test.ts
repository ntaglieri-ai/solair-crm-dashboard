import { describe, expect, it } from "vitest"
import {
  contaCondizioni,
  potaVuoti,
  validaAlbero,
  type CampoFiltrabile,
  type Gruppo,
} from "../albero"
import { condizioniCollegate, traduciAlbero } from "../traduci"

const CATALOGO: CampoFiltrabile[] = [
  { chiave: "Nome Lead", etichetta: "Nome", tipo: "testo" },
  {
    chiave: "Stato Lead",
    etichetta: "Stato",
    tipo: "elenco",
    opzioni: ["Contattato", "Perso", "Non contattato"],
  },
  { chiave: "Valutazione", etichetta: "Valutazione", tipo: "numero" },
  { chiave: "Ora creazione", etichetta: "Creato", tipo: "data" },
  { chiave: "Residente in Sicilia", etichetta: "Sicilia", tipo: "booleano" },
  { chiave: "Attività aperte", etichetta: "Attività aperte", tipo: "collegato" },
]

const COLONNE: Record<string, string> = {
  "Nome Lead": "nome_lead",
  "Stato Lead": "stato_lead",
  Valutazione: "valutazione",
  "Ora creazione": "created_at",
  "Residente in Sicilia": "residente_in_sicilia",
}

function gruppo(nodi: unknown[], connettore: "e" | "o" = "e") {
  return { tipo: "gruppo", connettore, nodi }
}
function cond(campo: string, operatore: string, valori: unknown[] = []) {
  return { tipo: "condizione", campo, operatore, valori }
}

describe("validaAlbero", () => {
  it("accetta un filtro semplice", () => {
    const esito = validaAlbero(gruppo([cond("Nome Lead", "contiene", ["rossi"])]), CATALOGO)
    expect(esito.ok).toBe(true)
  })

  it("rifiuta un campo che non e' nel catalogo", () => {
    // Senza questo controllo si potrebbe chiedere al database di filtrare su
    // una colonna qualsiasi, comprese quelle che l'utente non deve vedere.
    const esito = validaAlbero(gruppo([cond("password", "uguale", ["x"])]), CATALOGO)
    expect(esito.ok).toBe(false)
    if (!esito.ok) expect(esito.errore).toContain("password")
  })

  it("rifiuta un operatore incompatibile col tipo del campo", () => {
    const esito = validaAlbero(gruppo([cond("Valutazione", "contiene", ["x"])]), CATALOGO)
    expect(esito.ok).toBe(false)
  })

  it("rifiuta un valore fuori dalle opzioni di un elenco", () => {
    const esito = validaAlbero(
      gruppo([cond("Stato Lead", "uno_di", ["Inventato"])]),
      CATALOGO,
    )
    expect(esito.ok).toBe(false)
  })

  it("non pretende valori dagli operatori che non ne vogliono", () => {
    const esito = validaAlbero(gruppo([cond("Nome Lead", "vuoto")]), CATALOGO)
    expect(esito.ok).toBe(true)
  })

  it("pretende due valori per 'fra'", () => {
    expect(validaAlbero(gruppo([cond("Valutazione", "fra", [10])]), CATALOGO).ok).toBe(false)
    expect(validaAlbero(gruppo([cond("Valutazione", "fra", [10, 20])]), CATALOGO).ok).toBe(true)
  })

  it("rifiuta un annidamento oltre il limite tecnico", () => {
    // Non e' un limite per chi compone: serve contro un albero costruito ad
    // arte e spedito all'endpoint.
    let nodo: unknown = cond("Nome Lead", "contiene", ["x"])
    for (let i = 0; i < 15; i += 1) nodo = gruppo([nodo])
    expect(validaAlbero(nodo, CATALOGO).ok).toBe(false)
  })

  it("accetta gruppi annidati piu' volte entro il limite", () => {
    const albero = gruppo([
      gruppo([cond("Stato Lead", "uno_di", ["Perso"]), cond("Nome Lead", "contiene", ["a"])], "o"),
      cond("Valutazione", "maggiore", [30]),
    ])
    expect(validaAlbero(albero, CATALOGO).ok).toBe(true)
  })
})

describe("traduciAlbero", () => {
  function traduci(albero: unknown) {
    const validato = validaAlbero(albero, CATALOGO)
    if (!validato.ok) throw new Error(validato.errore)
    const esito = traduciAlbero(validato.gruppo, CATALOGO, COLONNE)
    if (!esito.ok) throw new Error(esito.errore)
    return esito.espressione
  }

  it("traduce una condizione singola senza involucro inutile", () => {
    expect(traduci(gruppo([cond("Stato Lead", "uno_di", ["Perso"])]))).toBe(
      'stato_lead.in.("Perso")',
    )
  })

  it("unisce con and le condizioni di un gruppo in E", () => {
    const espressione = traduci(
      gruppo([cond("Stato Lead", "uno_di", ["Perso"]), cond("Valutazione", "maggiore", [30])]),
    )
    expect(espressione).toBe('and(stato_lead.in.("Perso"),valutazione.gt.30)')
  })

  it("annida or dentro and, come nel caso che una lista piatta non sa dire", () => {
    const espressione = traduci(
      gruppo([
        gruppo(
          [cond("Stato Lead", "uno_di", ["Perso"]), cond("Stato Lead", "uno_di", ["Contattato"])],
          "o",
        ),
        cond("Valutazione", "maggiore", [30]),
      ]),
    )
    expect(espressione).toBe(
      'and(or(stato_lead.in.("Perso"),stato_lead.in.("Contattato")),valutazione.gt.30)',
    )
  })

  it("mette fra virgolette i valori con virgole e parentesi", () => {
    // Senza virgolette, una virgola nel valore verrebbe letta come
    // separatore fra condizioni e cambierebbe il significato del filtro.
    const espressione = traduci(gruppo([cond("Nome Lead", "uguale", ["Rossi, Mario (SRL)"])]))
    expect(espressione).toBe('nome_lead.eq."Rossi, Mario (SRL)"')
  })

  it("raddoppia le virgolette contenute nel valore", () => {
    const espressione = traduci(gruppo([cond("Nome Lead", "uguale", ['Bar "Da Gino"'])]))
    expect(espressione).toBe('nome_lead.eq."Bar ""Da Gino"""')
  })

  it("considera vuoto come 'no' sui booleani", () => {
    // Chi guarda la scheda vede "No" anche quando il campo non e' mai stato
    // toccato: il filtro deve comportarsi allo stesso modo.
    expect(traduci(gruppo([cond("Residente in Sicilia", "falso")]))).toBe(
      "or(residente_in_sicilia.is.false,residente_in_sicilia.is.null)",
    )
  })

  it("include gli estremi in 'fra'", () => {
    expect(traduci(gruppo([cond("Valutazione", "fra", [10, 20])]))).toBe(
      "and(valutazione.gte.10,valutazione.lte.20)",
    )
  })

  it("torna null quando non c'e' nulla da filtrare", () => {
    expect(traduci(gruppo([]))).toBeNull()
  })

  it("lascia fuori dall'espressione le condizioni sui collegati", () => {
    // Non sono colonne del record: si risolvono con una lettura a parte.
    const espressione = traduci(
      gruppo([cond("Attività aperte", "presente"), cond("Valutazione", "maggiore", [30])]),
    )
    expect(espressione).toBe("valutazione.gt.30")
  })
})

describe("condizioniCollegate", () => {
  it("raccoglie le condizioni sui collegati a ogni livello", () => {
    const validato = validaAlbero(
      gruppo([gruppo([cond("Attività aperte", "assente")], "o"), cond("Valutazione", "maggiore", [1])]),
      CATALOGO,
    )
    expect(validato.ok).toBe(true)
    if (validato.ok) {
      const collegate = condizioniCollegate(validato.gruppo)
      expect(collegate).toHaveLength(1)
      expect(collegate[0].campo).toBe("Attività aperte")
    }
  })
})

describe("potaVuoti e contaCondizioni", () => {
  const albero: Gruppo = {
    tipo: "gruppo",
    connettore: "e",
    nodi: [
      { tipo: "gruppo", connettore: "o", nodi: [] },
      { tipo: "condizione", campo: "Nome Lead", operatore: "contiene", valori: ["a"] },
    ],
  }

  it("toglie i gruppi rimasti senza condizioni", () => {
    // Comporre un filtro lascia gruppi aperti e mai riempiti: tradotti come
    // sono darebbero condizioni vuote.
    expect(potaVuoti(albero).nodi).toHaveLength(1)
  })

  it("conta le condizioni a ogni livello", () => {
    expect(contaCondizioni(albero)).toBe(1)
  })
})
