// Provisioning account Supabase Auth per nuovi utenti CRM.
// Flusso: riceve/genera la password temporanea CRM -> crea account Auth con
// admin.createUser (email_confirm: true, NIENTE invito via magic-link) ->
// collega auth_user_id -> invia la password via email (SMTP, vedi
// lib/email/mailer.ts) -> must_change_password resta true finche' l'utente
// non la cambia da /cambia-password.
import { randomBytes } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { sendWelcomeEmail, sendPasswordResetEmail } from "@/lib/email/mailer"

export type WelcomeEmailStatus = "pending" | "sent" | "failed"

export type AuthProvisionResult = {
  authUserId: string | null
  emailStatus: WelcomeEmailStatus
  emailError: string | null
  error: string | null
}

/** Password temporanea forte (12+ char, maiuscole/minuscole/numeri/simboli). */
export function generateTempPassword(): string {
  const raw = randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "")
  return `Tq7!${raw}`.slice(0, 16)
}

/**
 * Crea l'account Supabase Auth per un utente CRM appena inserito, collega
 * auth_user_id e invia la password temporanea via email. Non lancia: ritorna
 * sempre un risultato, cosi' il chiamante puo' degradare (utente CRM resta
 * creato anche se Auth o l'email falliscono) senza bloccare.
 */
export async function provisionAuthUser(utente: {
  id: string
  email: string
  nome: string
  tempPassword?: string
}): Promise<AuthProvisionResult> {
  const admin = createAdminClient()
  if (!admin) {
    return {
      authUserId: null,
      emailStatus: "failed",
      emailError: null,
      error: "SUPABASE_SERVICE_ROLE_KEY non configurata: impossibile creare l'account Auth",
    }
  }

  const tempPassword = utente.tempPassword ?? generateTempPassword()
  const { data, error: createError } = await admin.auth.admin.createUser({
    email: utente.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError || !data?.user) {
    return {
      authUserId: null,
      emailStatus: "failed",
      emailError: null,
      error: createError?.message ?? "Creazione account Auth fallita",
    }
  }

  const authUserId = data.user.id
  const supabase = await createClient()
  const { error: linkError } = await supabase
    .from("utenti")
    .update({ auth_user_id: authUserId, must_change_password: true })
    .eq("id", utente.id)

  if (linkError) {
    return {
      authUserId,
      emailStatus: "failed",
      emailError: null,
      error: `Account Auth creato ma collegamento auth_user_id fallito: ${linkError.message}`,
    }
  }

  const emailResult = await sendWelcomeEmail({
    to: utente.email,
    nome: utente.nome,
    tempPassword,
  })
  const emailStatus: WelcomeEmailStatus = emailResult.ok ? "sent" : "failed"

  await supabase
    .from("utenti")
    .update({ welcome_email_status: emailStatus, welcome_email_error: emailResult.error })
    .eq("id", utente.id)

  return { authUserId, emailStatus, emailError: emailResult.error, error: null }
}

/**
 * Rilancio manuale (azione "Riprova" da Account Management): genera una
 * NUOVA password temporanea, la imposta sull'account Auth esistente (non
 * conosciamo piu' in chiaro quella iniziale) e rispedisce l'email.
 */
export async function retryWelcomeEmail(utente: {
  id: string
  email: string
  nome: string
  auth_user_id: string | null
}): Promise<AuthProvisionResult> {
  const admin = createAdminClient()
  if (!admin) {
    return {
      authUserId: utente.auth_user_id,
      emailStatus: "failed",
      emailError: null,
      error: "SUPABASE_SERVICE_ROLE_KEY non configurata: impossibile aggiornare l'account Auth",
    }
  }

  if (!utente.auth_user_id) {
    return await provisionAuthUser(utente)
  }

  const tempPassword = generateTempPassword()
  const { error: updateError } = await admin.auth.admin.updateUserById(utente.auth_user_id, {
    password: tempPassword,
  })

  if (updateError) {
    return {
      authUserId: utente.auth_user_id,
      emailStatus: "failed",
      emailError: null,
      error: `Reset password temporanea fallito: ${updateError.message}`,
    }
  }

  const supabase = await createClient()
  await supabase
    .from("utenti")
    .update({ must_change_password: true })
    .eq("id", utente.id)

  const emailResult = await sendWelcomeEmail({
    to: utente.email,
    nome: utente.nome,
    tempPassword,
  })
  const emailStatus: WelcomeEmailStatus = emailResult.ok ? "sent" : "failed"

  await supabase
    .from("utenti")
    .update({ welcome_email_status: emailStatus, welcome_email_error: emailResult.error })
    .eq("id", utente.id)

  return { authUserId: utente.auth_user_id, emailStatus, emailError: emailResult.error, error: null }
}

/**
 * Reset self-service (flusso "Password dimenticata?" dalla pagina di login):
 * genera una NUOVA password temporanea, la imposta sull'account Auth esistente,
 * rialza must_change_password e invia l'email di reset. Stessa infrastruttura
 * di retryWelcomeEmail ma con wording dedicato; NON tocca welcome_email_status,
 * che appartiene al flusso di onboarding e non a un reset spontaneo.
 */
export async function sendPasswordReset(utente: {
  id: string
  email: string
  nome: string
  auth_user_id: string | null
}): Promise<AuthProvisionResult> {
  const admin = createAdminClient()
  if (!admin) {
    return {
      authUserId: utente.auth_user_id,
      emailStatus: "failed",
      emailError: null,
      error: "SUPABASE_SERVICE_ROLE_KEY non configurata: impossibile aggiornare l'account Auth",
    }
  }

  if (!utente.auth_user_id) {
    return {
      authUserId: null,
      emailStatus: "failed",
      emailError: null,
      error: "Utente senza account Auth collegato: reset non applicabile",
    }
  }

  const tempPassword = generateTempPassword()
  const { error: updateError } = await admin.auth.admin.updateUserById(utente.auth_user_id, {
    password: tempPassword,
  })

  if (updateError) {
    return {
      authUserId: utente.auth_user_id,
      emailStatus: "failed",
      emailError: null,
      error: `Reset password temporanea fallito: ${updateError.message}`,
    }
  }

  const supabase = await createClient()
  await supabase
    .from("utenti")
    .update({ must_change_password: true })
    .eq("id", utente.id)

  const emailResult = await sendPasswordResetEmail({
    to: utente.email,
    nome: utente.nome,
    tempPassword,
  })
  const emailStatus: WelcomeEmailStatus = emailResult.ok ? "sent" : "failed"

  return {
    authUserId: utente.auth_user_id,
    emailStatus,
    emailError: emailResult.error,
    error: null,
  }
}
