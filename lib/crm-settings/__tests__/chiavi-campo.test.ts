import { describe, expect, it } from "vitest"
import { colonnaPerChiaveLayout, TABELLA_PER_LAYOUT_MODULO } from "../chiavi-campo"

/**
 * Il ponte fra le due lingue del CRM e' il punto in cui un errore non si vede:
 * una traduzione sbagliata non fa fallire niente, attacca semplicemente la
 * formula di un campo alla colonna di un altro. Qui si fissa il comportamento
 * su cui si appoggiano sia il travaso sia il render della scheda.
 */

describe("colonnaPerChiaveLayout", () => {
  it("traduce le etichette Zoho dei clienti in nomi di colonna", () => {
    expect(colonnaPerChiaveLayout("Nome Clienti", "system", "clienti")).toBe("nome_clienti")
    expect(colonnaPerChiaveLayout("Saldo", "system", "clienti")).toBe("saldo")
    expect(colonnaPerChiaveLayout("Codice fiscale", "system", "clienti")).toBe("codice_fiscale")
  })

  it("traduce le etichette applicative dei lead", () => {
    expect(colonnaPerChiaveLayout("Stato Lead", "system", "lead")).toBe("stato_lead")
    expect(colonnaPerChiaveLayout("Nome Lead", "system", "lead")).toBe("nome_lead")
  })

  it("recupera le etichette Zoho che non coincidono con quella applicativa", () => {
    // Casi reali trovati sul layout clienti: Zoho tiene parentesi e spazi che
    // il nome applicativo perde, e senza ripiego questi campi restavano senza
    // colonna con la loro definizione bloccata sul piazzamento.
    expect(colonnaPerChiaveLayout("Tempo medio impiegato (minuti)", "system", "clienti")).toBe(
      "tempo_medio_impiegato_minuti",
    )
    expect(colonnaPerChiaveLayout("Tot Potenza AC (KW)", "system", "clienti")).toBe(
      "tot_potenza_ac_kw",
    )
    expect(colonnaPerChiaveLayout("Fattura 1", "system", "clienti")).toBe("fattura1")
  })

  it("non inventa una colonna per una chiave che non conosce", () => {
    // Preferisce ammettere di non sapere: chi chiama lo riporta come "non
    // risolto" e un umano decide, invece di scrivere su una colonna a caso.
    expect(colonnaPerChiaveLayout("Campo Che Non Esiste", "system", "clienti")).toBeNull()
    expect(colonnaPerChiaveLayout("Fantasia", "system", "lead")).toBeNull()
  })

  it("tratta le chiavi custom come nomi di colonna, se sono validi", () => {
    expect(colonnaPerChiaveLayout("valore_stimato", "custom", "clienti")).toBe("valore_stimato")
    // Una chiave custom con spazi o maiuscole non e' un nome di colonna: non
    // puo' essere usata in una query e va rifiutata qui, non a valle.
    expect(colonnaPerChiaveLayout("Valore Stimato", "custom", "clienti")).toBeNull()
    expect(colonnaPerChiaveLayout("1_inizia_con_cifra", "custom", "clienti")).toBeNull()
  })

  it("usa la chiave cosi' com'e' nei moduli senza etichette Zoho", () => {
    // installatori e compiti lavorano gia' in snake_case: non c'e' un livello
    // di etichette da attraversare.
    expect(colonnaPerChiaveLayout("canale_preferito", "system", "installatori")).toBe(
      "canale_preferito",
    )
    expect(colonnaPerChiaveLayout("priorita", "system", "compiti")).toBe("priorita")
    expect(colonnaPerChiaveLayout("Canale Preferito", "system", "installatori")).toBeNull()
  })

  it("mappa il modulo lead sulla tabella al plurale", () => {
    // Il modulo si chiama "lead" ma la tabella "leads": e' il tipo di dettaglio
    // che, sbagliato, fa fallire ogni query del travaso.
    expect(TABELLA_PER_LAYOUT_MODULO.lead).toBe("leads")
    expect(TABELLA_PER_LAYOUT_MODULO.clienti).toBe("clienti")
  })
})
