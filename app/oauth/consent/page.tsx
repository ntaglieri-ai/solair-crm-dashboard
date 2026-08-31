import { redirect } from "next/navigation"
import { CONSENT_ERRORS, NEXTCLOUD_AUTHORIZE_PATH } from "@/lib/nextcloud/oauth-consent"

export const dynamic = "force-dynamic"

// Authorization UI first-party per Nextcloud. Accetta soltanto il client ID
// configurato e approva automaticamente: l'utente ha gia' espresso l'intento
// premendo "Apri Nextcloud", quindi non serve un secondo click di consenso.
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>
}) {
  const { authorization_id: authorizationId, error } = await searchParams
  if (error) {
    const message = Object.hasOwn(CONSENT_ERRORS, error)
      ? CONSENT_ERRORS[error as keyof typeof CONSENT_ERRORS]
      : CONSENT_ERRORS.request
    return <OAuthError message={message} />
  }
  if (!authorizationId) {
    return <OAuthError message="Richiesta OIDC priva di authorization_id." />
  }

  // Token refresh and consent must run where Set-Cookie can be persisted.
  // Server Components cannot write refreshed/cleared authentication cookies.
  redirect(`${NEXTCLOUD_AUTHORIZE_PATH}?authorization_id=${encodeURIComponent(authorizationId)}`)
}

function OAuthError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF1F9] p-6">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-[#1E3A5F]">Accesso Nextcloud non disponibile</h1>
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      </div>
    </main>
  )
}
