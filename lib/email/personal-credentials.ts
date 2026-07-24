// Persistenza cifrata delle credenziali email personali per-utente (mittente
// reale nelle email verso i lead), tramite RPC pgcrypto. Stesso pattern di
// lib/nextcloud/credentials.ts. Tutto passa dal service_role: i segreti non
// toccano mai un client autenticato dal browser.

import { createAdminClient } from "@/lib/supabase/admin"
import { nextcloudCredKey } from "@/lib/nextcloud/config"

export type EmailCredStatus = "active" | "pending" | "failed"

export type StoreEmailCredentialParams = {
  utenteId: string
  smtpUser: string
  smtpPassword?: string | null
  status: EmailCredStatus
  lastError?: string | null
}

export async function storePersonalEmailCredential(
  params: StoreEmailCredentialParams,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  if (!admin) return { error: "Supabase service role non configurato" }

  const { error } = await admin.rpc("email_cred_upsert", {
    p_utente_id: params.utenteId,
    p_smtp_user: params.smtpUser,
    p_smtp_password: params.smtpPassword ?? null,
    p_key: nextcloudCredKey(),
    p_status: params.status,
    p_last_error: params.lastError ?? null,
  })

  return { error: error?.message ?? null }
}

export async function getPersonalEmailPassword(utenteId: string): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin.rpc("email_cred_get_password", {
    p_utente_id: utenteId,
    p_key: nextcloudCredKey(),
  })

  if (error) {
    console.error("[email] decrypt password personale fallita:", error.message)
    return null
  }
  return (data as string | null) ?? null
}

export type PersonalEmailStatus = {
  configured: boolean
  smtpUser: string | null
  status: EmailCredStatus | null
}

export async function getPersonalEmailStatus(utenteId: string): Promise<PersonalEmailStatus> {
  const admin = createAdminClient()
  if (!admin) return { configured: false, smtpUser: null, status: null }

  const { data, error } = await admin
    .from("email_credentials_personali")
    .select("smtp_user, status, smtp_password_enc")
    .eq("utente_id", utenteId)
    .maybeSingle()

  if (error || !data) return { configured: false, smtpUser: null, status: null }
  return {
    configured: data.smtp_password_enc != null,
    smtpUser: (data.smtp_user as string | null) ?? null,
    status: (data.status as EmailCredStatus | null) ?? null,
  }
}
