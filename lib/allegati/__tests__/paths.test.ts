import { describe, expect, it } from "vitest"
import { folderPathForRecord, isPathInsideRecordFolder, sanitizeName } from "../paths"

/**
 * I percorsi delle cartelle allegati.
 *
 * I Clienti si comportano diversamente dagli altri moduli: le loro cartelle
 * esistono da anni nell'archivio storico, create da persone, e il CRM deve
 * trovarle invece di crearne di nuove accanto.
 */

describe("folderPathForRecord — Clienti", () => {
  it("punta all'archivio storico, non a Vendita-Digitale", () => {
    const path = folderPathForRecord("cliente", "f36d826b-387b-4fbe-8148-265e89a0d601", "Gilda Monterosso")
    expect(path).toBe("Solair/Solair-Group/Clienti/Gilda Monterosso")
  })

  it("non aggiunge il suffisso dell'id", () => {
    // Le cartelle esistenti non ce l'hanno: aggiungerlo creerebbe una
    // cartella nuova accanto a quella vera, e i documenti finirebbero in
    // due posti.
    const path = folderPathForRecord("cliente", "abc123-def456", "Mario Rossi")
    expect(path).not.toMatch(/ - [a-f0-9]{6}$/)
    expect(path.endsWith("/Mario Rossi")).toBe(true)
  })

  it("toglie dai nomi i caratteri che Nextcloud rifiuta", () => {
    const path = folderPathForRecord("cliente", "x", 'Ittica sud S.R.L. / "Lo Presti"')
    expect(path).not.toContain('"')
    expect(path.split("/").length).toBe(4)
  })
})

describe("folderPathForRecord — altri moduli", () => {
  it("i Lead mantengono il suffisso dell'id", () => {
    // Li' le cartelle le crea il CRM: il suffisso evita che due omonimi
    // finiscano nella stessa.
    const path = folderPathForRecord("lead", "aaaaaaaa-bbbb-cccc-dddd-eeeeee123456", "Mario Rossi")
    expect(path).toBe("Solair/Vendita-Digitale/Preventivi progetto 2.0/Mario Rossi - 123456")
  })

  it("gli Installatori restano dov'erano", () => {
    const path = folderPathForRecord("installatore", "aaaaaaaa-bbbb-cccc-dddd-eeeeee123456", "Rossi Impianti")
    expect(path.startsWith("Solair/Vendita-Digitale/INSTALLATORI/")).toBe(true)
  })
})

describe("isPathInsideRecordFolder", () => {
  const id = "f36d826b-387b-4fbe-8148-265e89a0d601"

  it("accetta un file dentro la cartella del cliente", () => {
    expect(
      isPathInsideRecordFolder(
        "cliente",
        id,
        "Gilda Monterosso",
        "Solair/Solair-Group/Clienti/Gilda Monterosso/ENEL/foto.jpeg",
      ),
    ).toBe(true)
  })

  it("rifiuta la cartella di un altro cliente", () => {
    // Le route allegati usano le credenziali amministrative e vedono tutto:
    // senza questo controllo un percorso preso dall'indirizzo darebbe
    // accesso ai documenti di chiunque.
    expect(
      isPathInsideRecordFolder(
        "cliente",
        id,
        "Gilda Monterosso",
        "Solair/Solair-Group/Clienti/Mario Rossi/contratto.pdf",
      ),
    ).toBe(false)
  })

  it("rifiuta i tentativi di risalire l'albero", () => {
    expect(
      isPathInsideRecordFolder(
        "cliente",
        id,
        "Gilda Monterosso",
        "Solair/Solair-Group/Clienti/Gilda Monterosso/../Mario Rossi/x.pdf",
      ),
    ).toBe(false)
  })
})

describe("sanitizeName", () => {
  it("toglie i caratteri vietati e normalizza gli spazi", () => {
    expect(sanitizeName('  Rossi\\Mario: "SRL"  ')).toBe("RossiMario SRL")
  })
})
