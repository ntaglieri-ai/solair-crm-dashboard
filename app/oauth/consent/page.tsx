import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// Authorization UI first-party per Nextcloud. Accetta soltanto il client ID
// configurato e approva automaticamente: l'utente ha gia' espresso l'intento
// premendo "Apri Nextcloud", quindi non serve un secondo click di consenso.
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>
}) {
  const authorizationId = (await searchParams).authorization_id
  if (!authorizationId) {
    return <OAuthError message="Richiesta OIDC priva di authorization_id." />
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
    redirect(`/login?redirect=${encodeURIComponent(back)}`)
  }

  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !details) {
    return <OAuthError message={error?.message ?? "Richiesta OIDC non valida o scaduta."} />
  }

  if ("redirect_url" in details) redirect(details.redirect_url)

  const allowedClientId = process.env.SUPABASE_OAUTH_NEXTCLOUD_CLIENT_ID
  if (!allowedClientId || details.client.id !== allowedClientId) {
    return <OAuthError message="Client OIDC non autorizzato per il CRM." />
  }

  const { data: approved, error: approveError } =
    await supabase.auth.oauth.approveAuthorization(authorizationId)
  if (approveError || !approved?.redirect_url) {
    return <OAuthError message={approveError?.message ?? "Autorizzazione OIDC non riuscita."} />
  }

  redirect(approved.redirect_url)
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
