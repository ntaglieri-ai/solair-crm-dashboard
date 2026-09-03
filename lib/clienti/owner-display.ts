import type { ClienteRecord } from "@/lib/mock-data"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function displayClienteOwner(
  cliente: Pick<ClienteRecord, "Clienti Proprietario" | "ClientiProprietarioNome">,
  ownerNames: Record<string, string>,
  fallback = "Non assegnato",
): string {
  const value = cliente["Clienti Proprietario"]?.trim()
  const legacyName = cliente.ClientiProprietarioNome?.trim()

  if (!value) return legacyName || fallback
  if (ownerNames[value]) return ownerNames[value]
  if (UUID_RE.test(value)) return legacyName || "Utente non disponibile"
  return value
}
