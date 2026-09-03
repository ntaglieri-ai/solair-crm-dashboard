import { describe, expect, it } from "vitest"
import { displayClienteOwner } from "@/lib/clienti/owner-display"

describe("displayClienteOwner", () => {
  it("mostra il nome utente quando il cliente ha un id proprietario valido", () => {
    expect(
      displayClienteOwner(
        { "Clienti Proprietario": "11111111-1111-4111-8111-111111111111" },
        { "11111111-1111-4111-8111-111111111111": "Ivan Lo Faro" },
      ),
    ).toBe("Ivan Lo Faro")
  })

  it("usa il nome Zoho quando il vecchio cliente non ha id proprietario", () => {
    expect(
      displayClienteOwner(
        { "Clienti Proprietario": "Mariarosa De Leo" },
        {},
      ),
    ).toBe("Mariarosa De Leo")
  })

  it("usa il nome Zoho anche se l'id importato non combacia piu' con utenti", () => {
    expect(
      displayClienteOwner(
        {
          "Clienti Proprietario": "22222222-2222-4222-8222-222222222222",
          ClientiProprietarioNome: "Filiale Messina",
        },
        {},
      ),
    ).toBe("Filiale Messina")
  })
})
