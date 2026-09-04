import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail: mocks.sendMail })) } }))
import { sendWelcomeEmail, sendPasswordResetEmail, sendMentionNotificationEmail } from "../mailer"
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
  it.each([sendWelcomeEmail, sendPasswordResetEmail])("sends the existing template to the intended recipient", async (send) => {
    expect(await send({ to: "recipient@example.test", nome: "<Mario>", tempPassword: "test-only" })).toEqual({ ok: true, error: null })
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.to).toBe("recipient@example.test")
    expect(mail.from).toBe("crm@example.test")
    expect(mail.html).toContain("&lt;Mario&gt;")
    expect(mail.text).toContain("https://crm.example.test/login")
  })
  it("sends mention notifications, escapes markup and excludes the author", async () => {
    const failed = await notifyMentionedUsers({ recipients: [
      { id: "author", nome: "Author", email: "author@example.test" },
      { id: "other", nome: "Other", email: "recipient@example.test" },
    ], authorId: "author", authorName: "Author", text: "<script>bad</script>", recordLabel: "Test", recordUrl: "https://crm.example.test/clienti/test" })
    expect(failed).toBe(0)
    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
    expect(mocks.sendMail.mock.calls[0][0].html).toContain("&lt;script&gt;")
  })
  it("reports SMTP failure rather than success", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP unavailable"))
    expect(await sendWelcomeEmail({ to: "recipient@example.test", nome: "Test", tempPassword: "test" })).toEqual({ ok: false, error: "SMTP unavailable" })
  })
  it("does not attempt sending when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "")
    expect((await sendMentionNotificationEmail({ to: "recipient@example.test", recipientName: "Test", authorName: "Test", noteText: "test", recordLabel: "test", recordUrl: "https://crm.example.test" })).ok).toBe(false)
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
})
