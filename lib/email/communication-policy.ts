import { createAdminClient } from "@/lib/supabase/admin"

export type BulkReplyToMode = "agente" | "azienda"
export type BulkPacingMode = "prudente" | "ses"

export type CommunicationEmailPolicy = {
  provider: "aws-ses"
  region: string
  domain: string
  fromEmail: string
  fromName: string
  replyTo: string
  bulkReplyTo: BulkReplyToMode
  bulkPacing: BulkPacingMode
}

export const DEFAULT_COMMUNICATION_EMAIL_POLICY: CommunicationEmailPolicy = {
  provider: "aws-ses",
  region: "eu-west-1",
  domain: "solairgroup.it",
  fromEmail: "commerciale@solairgroup.it",
  fromName: "Solair CRM",
  replyTo: "commerciale@solairgroup.it",
  bulkReplyTo: "agente",
  bulkPacing: "ses",
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function asBulkReplyTo(value: unknown): BulkReplyToMode {
  return value === "azienda" ? "azienda" : "agente"
}

function asBulkPacing(value: unknown): BulkPacingMode {
  return value === "prudente" ? "prudente" : "ses"
}

export function normalizeCommunicationEmailPolicy(value: unknown): CommunicationEmailPolicy {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const email = source.email && typeof source.email === "object"
    ? source.email as Record<string, unknown>
    : {}
  const legacySmtp = source.smtp && typeof source.smtp === "object"
    ? source.smtp as Record<string, unknown>
    : {}

  return {
    provider: "aws-ses",
    region: asString(email.region, DEFAULT_COMMUNICATION_EMAIL_POLICY.region),
    domain: asString(email.domain, DEFAULT_COMMUNICATION_EMAIL_POLICY.domain),
    fromEmail: asString(
      email.fromEmail ?? legacySmtp.fromEmail,
      DEFAULT_COMMUNICATION_EMAIL_POLICY.fromEmail,
    ),
    fromName: asString(
      email.fromName ?? legacySmtp.fromName,
      DEFAULT_COMMUNICATION_EMAIL_POLICY.fromName,
    ),
    replyTo: asString(
      email.replyTo ?? legacySmtp.replyTo,
      DEFAULT_COMMUNICATION_EMAIL_POLICY.replyTo,
    ),
    bulkReplyTo: asBulkReplyTo(email.bulkReplyTo),
    bulkPacing: asBulkPacing(email.bulkPacing),
  }
}

export async function getCommunicationEmailPolicy(): Promise<CommunicationEmailPolicy> {
  const admin = createAdminClient()
  if (!admin) return DEFAULT_COMMUNICATION_EMAIL_POLICY

  const { data, error } = await admin
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "system.communication")
    .maybeSingle()

  if (error) {
    console.error("[email-policy] lettura crm_settings(system.communication) fallita:", error.message)
    return DEFAULT_COMMUNICATION_EMAIL_POLICY
  }

  return normalizeCommunicationEmailPolicy(data?.valore)
}
