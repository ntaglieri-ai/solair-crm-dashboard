import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail: mocks.sendMail })) } }))
import { sendWelcomeEmail, sendPasswordResetEmail, sendMentionNotificationEmail, sendDirectEmail, notePreview } from "../mailer"
import { notifyMentionedUsers } from "@/lib/notes/mentions-server"

beforeEach(() => {
  vi.stubEnv("SMTP_HOST", "smtp.example.test")
  vi.stubEnv("SMTP_PORT", "465")
  vi.stubEnv("SMTP_USER", "test")
  vi.stubEnv("SMTP_PASSWORD", "not-a-real-secret")
  vi.stubEnv("SMTP_FROM", "crm@example.test")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.example.test")
  mocks.sendMail.mockReset().mockResolvedValue({ accepted: ["recipient@example.test"] })
})
afterEach(() => vi.unstubAllEnvs())

describe("existing transactional emails (no network)", () => {
  it("sends the written internal-note body unchanged, safely escaped and without a CRM link", async () => {
    const body = "  @Mario Rossi\nControlla <script>test</script> & conferma.  "
    expect((await sendDirectEmail({ to: "recipient@example.test", subject: "Menzione interna", body })).ok).toBe(true)
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.text).toBe(body)
    expect(mail.html).toContain("&lt;script&gt;test&lt;/script&gt;")
    expect(mail.html).toContain("<br/>")
    expect(mail.html).not.toContain("<a ")
    expect(mail.text).not.toContain("Apri la scheda")
  })
  it.each([sendWelcomeEmail, sendPasswordResetEmail])("sends the existing template to the intended recipient", async (send) => {
    expect(await send({ to: "recipient@example.test", nome: "<Mario>", tempPassword: "test-only" })).toEqual({ ok: true, error: null })
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.to).toBe("recipient@example.test")
    expect(mail.from).toBe("crm@example.test")
    expect(mail.html).toContain("&lt;Mario&gt;")
    expect(mail.text).toContain("https://crm.example.test/login")
  })
  it("sends mention notifications to everyone mentioned, author included, escaping markup", async () => {
    const failed = await notifyMentionedUsers({ recipients: [
      { id: "author", nome: "Author", email: "author@example.test" },
      { id: "other", nome: "Other", email: "recipient@example.test" },
    ], authorName: "Author", text: "<script>bad</script>", recordLabel: "Cliente", recordName: "Mario Rossi", recordUrl: "https://crm.example.test/clienti/test" })
    expect(failed).toBe(0)
    expect(mocks.sendMail).toHaveBeenCalledTimes(2)
    expect(mocks.sendMail.mock.calls[0][0].html).toContain("&lt;script&gt;")
  })
  it("names the record and previews the note, in the subject and in both bodies", async () => {
    expect((await sendMentionNotificationEmail({
      to: "recipient@example.test", recipientName: "Destinatario", authorName: "Autore",
      noteText: "@Destinatario il cliente chiede\nun aggiornamento sull'installazione.",
      recordLabel: "Cliente", recordName: "Antonino Molino",
      recordUrl: "https://crm.example.test/clienti/abc",
    })).ok).toBe(true)
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.subject).toBe("Autore ti ha menzionato in una nota — Cliente Antonino Molino")
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Antonino Molino")
      expect(body).toContain("https://crm.example.test/clienti/abc")
    }
    expect(mail.text).toContain("un aggiornamento sull'installazione.")
    // L'anteprima passa da escapeHtml: l'apostrofo arriva come entita'.
    expect(mail.html).toContain("un aggiornamento sull&#39;installazione.")
  })
  it("still sends a usable notification when the record name cannot be resolved", async () => {
    expect((await sendMentionNotificationEmail({
      to: "recipient@example.test", recipientName: "Destinatario", authorName: "Autore",
      noteText: "nota", recordLabel: "Cliente", recordName: "  ",
      recordUrl: "https://crm.example.test/clienti/abc",
    })).ok).toBe(true)
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.subject).toBe("Autore ti ha menzionato in una nota — Cliente")
    expect(mail.text).toContain("Cliente: non disponibile")
  })
  it("truncates a long note on a word boundary instead of sending it whole", async () => {
    const long = "parola ".repeat(200).trim()
    expect((await sendMentionNotificationEmail({
      to: "recipient@example.test", recipientName: "Destinatario", authorName: "Autore",
      noteText: long, recordLabel: "Cliente", recordName: "Mario Rossi",
      recordUrl: "https://crm.example.test/clienti/abc",
    })).ok).toBe(true)
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.text).toContain("...")
    expect(mail.text).not.toContain(long)
    expect(notePreview(long).length).toBeLessThanOrEqual(403)
    expect(notePreview(long)).not.toMatch(/paro\.\.\.$/)
  })
  it("keeps a short note intact", () => {
    expect(notePreview("  una nota breve  ")).toBe("una nota breve")
  })
  it("reports SMTP failure rather than success", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP unavailable"))
    expect(await sendWelcomeEmail({ to: "recipient@example.test", nome: "Test", tempPassword: "test" })).toEqual({ ok: false, error: "SMTP unavailable" })
  })
  it("does not attempt sending when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "")
    expect((await sendMentionNotificationEmail({ to: "recipient@example.test", recipientName: "Test", authorName: "Test", noteText: "test", recordLabel: "Cliente", recordName: "Mario Rossi", recordUrl: "https://crm.example.test" })).ok).toBe(false)
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
})
