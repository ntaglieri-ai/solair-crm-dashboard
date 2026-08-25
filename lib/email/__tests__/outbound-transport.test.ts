// Test di createAgentOutboundTransport: chi finisce nel From, chi nel Reply-To,
// e quando le credenziali personali del Profilo sono davvero indispensabili.
//
// Perche' esiste: il blocco "Configura prima la tua casella email personale nel
// tuo Profilo" era incondizionato sulle route di invio, e con
// email_credentials_personali vuota bloccava ogni utente — anche con SES di
// sistema perfettamente configurato. La regressione era invisibile leggendo la
// route: bisogna sapere che sul ramo SES `smtpPassword` non viene mai usata e
// che `smtpUser` serve solo come indirizzo di Reply-To. Questi test lo fissano.
//
// Cosa NON copre, dichiarato: le route HTTP e la lettura della policy da
// crm_settings. Qui si verifica solo la costruzione del transport.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// nodemailer non deve aprire connessioni: si intercetta createTransport e si
// guarda solo con quale configurazione viene chiamato.
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn((config: unknown) => ({ config, sendMail: vi.fn(), close: vi.fn() })),
  },
}))

import { createAgentOutboundTransport, hasSystemOutboundSmtp } from "../lead-mailer"

const SES_ENV = {
  SMTP_HOST: "email-smtp.eu-west-1.amazonaws.com",
  SMTP_PORT: "465",
  SMTP_USER: "AKIAFAKEACCESSKEY",
  SMTP_PASSWORD: "fake-ses-smtp-password",
  SMTP_FROM: "commerciale@solairgroup.it",
}

const originalEnv = { ...process.env }

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(() => {
  for (const key of Object.keys(SES_ENV)) delete process.env[key]
  delete process.env.EMAIL_PROVIDER
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe("con SMTP di sistema (SES) configurato", () => {
  beforeEach(() => setEnv(SES_ENV))

  it("considera l'invio possibile senza casella personale", () => {
    expect(hasSystemOutboundSmtp()).toBe(true)
  })

  it("spedisce anche senza credenziali personali: e' il caso che era bloccato", () => {
    // Nessun smtpUser, nessuna smtpPassword: prima di questa correzione la
    // route non arrivava nemmeno qui, si fermava sul controllo del Profilo.
    expect(() => createAgentOutboundTransport({})).not.toThrow()
  })

  it("usa la casella scelta come From, lasciando le credenziali di sistema", () => {
    const outbound = createAgentOutboundTransport({
      fromEmail: "info@solairgroup.it",
      fromName: "Info Solair",
    })

    expect(outbound.from).toBe('"Info Solair" <info@solairgroup.it>')
    // Il punto centrale della feature: cambia il From, non l'autenticazione.
    expect((outbound.transport as unknown as { config: { auth: { user: string } } }).config.auth)
      .toMatchObject({ user: SES_ENV.SMTP_USER, pass: SES_ENV.SMTP_PASSWORD })
  })

  it("senza casella scelta lascia il mittente di sistema", () => {
    const outbound = createAgentOutboundTransport({})
    expect(outbound.from).toBe('"Solair CRM" <commerciale@solairgroup.it>')
  })

  it("mette in Reply-To l'indirizzo dell'agente, che non e' una credenziale", () => {
    const outbound = createAgentOutboundTransport({
      smtpUser: "gabriele.grasso@solairgroup.it",
      fromEmail: "vendite@solairgroup.it",
      fromName: "Vendite Solair",
    })

    expect(outbound.from).toBe('"Vendite Solair" <vendite@solairgroup.it>')
    // Nessuna password fornita, eppure il Reply-To e' valorizzato: e' proprio
    // il motivo per cui il blocco sul Profilo era di troppo.
    expect(outbound.replyTo).toBe("gabriele.grasso@solairgroup.it")
  })

  it("con replyToMode aziendale ignora l'indirizzo dell'agente", () => {
    const outbound = createAgentOutboundTransport({
      smtpUser: "gabriele.grasso@solairgroup.it",
      replyToMode: "company",
    })
    expect(outbound.replyTo).toBe("commerciale@solairgroup.it")
  })
})

describe("senza SMTP di sistema (fallback Aruba)", () => {
  it("considera l'invio impossibile finche' manca la casella personale", () => {
    expect(hasSystemOutboundSmtp()).toBe(false)
  })

  it("pretende le credenziali personali, che qui servono davvero", () => {
    expect(() => createAgentOutboundTransport({})).toThrow(/SMTP personale non configurato/)
    expect(() =>
      createAgentOutboundTransport({ smtpUser: "tizio@solairgroup.it" }),
    ).toThrow(/SMTP personale non configurato/)
  })

  it("ignora la casella scelta: il transport si autentica su quella personale", () => {
    const outbound = createAgentOutboundTransport({
      smtpUser: "tizio@solairgroup.it",
      smtpPassword: "password-aruba",
      fromEmail: "info@solairgroup.it",
      fromName: "Info Solair",
    })

    // Aruba non lascia spedire a nome di un altro indirizzo: meglio partire
    // dal proprio che fallire l'autenticazione.
    expect(outbound.from).toBe("tizio@solairgroup.it")
    expect(outbound.provider).toBe("personal-aruba")
  })
})
