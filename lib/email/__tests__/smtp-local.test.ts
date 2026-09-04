import { createServer, type Socket } from "node:net"
import { afterEach, expect, it, vi } from "vitest"
import { sendMentionNotificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../mailer"

afterEach(() => vi.unstubAllEnvs())

it("delivers all existing transactional templates to an isolated local SMTP sink", async () => {
  const received: string[] = []
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket))
    socket.setEncoding("utf8")
    socket.write("220 localhost test SMTP\r\n")
    let buffer = "", data = "", inData = false
    socket.on("data", (chunk) => {
      buffer += chunk
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n"), line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (inData) {
          if (line === ".") { received.push(data); data = ""; inData = false; socket.write("250 queued locally\r\n") }
          else data += line + "\r\n"
        } else if (/^EHLO|^HELO/.test(line)) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n")
        else if (line.startsWith("AUTH")) socket.write("235 test authenticated\r\n")
        else if (line === "DATA") { inData = true; socket.write("354 end with dot\r\n") }
        else if (line === "QUIT") socket.end("221 goodbye\r\n")
        else socket.write("250 OK\r\n")
      }
    })
  })
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
  try {
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("No local SMTP listener")
    vi.stubEnv("SMTP_HOST", "127.0.0.1"); vi.stubEnv("SMTP_PORT", String(address.port))
    vi.stubEnv("SMTP_USER", "local-test"); vi.stubEnv("SMTP_PASSWORD", "local-test")
    vi.stubEnv("SMTP_FROM", "crm@example.test"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.example.test")
    for (const send of [sendWelcomeEmail, sendPasswordResetEmail]) {
      expect((await send({ to: "recipient@example.test", nome: "Test", tempPassword: "test-only" })).ok).toBe(true)
    }
    expect((await sendMentionNotificationEmail({ to: "recipient@example.test", recipientName: "Test", authorName: "Author", noteText: "Note", recordLabel: "Test client", recordUrl: "https://crm.example.test/clienti/test" })).ok).toBe(true)
    expect(received).toHaveLength(3)
    for (const mail of received) {
      expect(mail).toContain("To: recipient@example.test")
      expect(mail).toContain("From: crm@example.test")
      expect(mail).toContain("Content-Type: multipart/alternative")
    }
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}, 10000)
