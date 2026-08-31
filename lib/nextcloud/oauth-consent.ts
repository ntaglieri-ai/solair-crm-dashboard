export const NEXTCLOUD_AUTHORIZE_PATH = "/api/auth/nextcloud/authorize"

export const CONSENT_ERRORS = {
  request: "Richiesta OIDC non valida o scaduta. Torna al CRM e riapri Nextcloud.",
  client: "Client OIDC non autorizzato per il CRM.",
  unavailable: "Autorizzazione temporaneamente non disponibile. Riprova dal CRM.",
} as const

export function isMissingAuthSession(error: { name?: string; code?: string } | null) {
  return error?.name === "AuthSessionMissingError" || [
    "session_not_found", "session_expired", "refresh_token_not_found",
    "refresh_token_already_used", "bad_jwt", "jwt_expired",
  ].includes(error?.code ?? "")
}
