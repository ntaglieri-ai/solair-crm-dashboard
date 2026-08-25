import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { PERCORSO_AUTORIZZAZIONE } from "@/lib/mcp/oauth/config"
import { leggiClient } from "@/lib/mcp/oauth/archivio"
import { deveCambiarePassword, verificaAuthUserId } from "@/lib/mcp/oauth/identita"
import { analizzaParametri, firmaRichiesta, urlDiRitorno } from "@/lib/mcp/oauth/richiesta"
import { createClient } from "@/lib/supabase/server"

/**
 * Endpoint di autorizzazione (GET) del connettore MCP: qui l'utente si
 * autentica e conferma il collegamento.
 *
 * Non c'e' un form di login duplicato: se manca la sessione, la pagina rimanda
 * al /login del CRM con `redirect` verso se stessa. Cosi' la password passa
 * dall'unico percorso che ha gia' throttle per IP, blocco IP, soglia tentativi
 * e registrazione in audit — riscriverne una copia qui significherebbe una
 * seconda porta d'ingresso con meno protezioni della prima.
 *
 * L'ordine dei controlli e' quello che conta:
 *   1. parametri e redirect_uri (whitelist rigida)  — prima di tutto;
 *   2. client registrato;
 *   3. sessione CRM (altrimenti login);
 *   4. utente attivo e ruolo ammesso;
 *   5. conferma esplicita -> POST /api/oauth-mcp/authorize.
 * Se il passo 4 fallisce non viene generato nessun codice e non si torna al
 * client: l'utente vede a schermo perche' e' stato fermato.
 */
export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

export default async function AutorizzaMcpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const query = new URLSearchParams()
  for (const [chiave, valore] of Object.entries(sp)) {
    if (typeof valore === "string") query.set(chiave, valore)
    else if (Array.isArray(valore) && valore[0]) query.set(chiave, valore[0])
  }

  if (!process.env.MCP_OAUTH_SIGNING_KEY) {
    return (
      <Esito
        titolo="Connettore non configurato"
        messaggio="Manca la chiave di firma dei token (MCP_OAUTH_SIGNING_KEY). Il collegamento non puo' essere completato: segnalalo a chi amministra il CRM."
      />
    )
  }

  // --- 1. Parametri --------------------------------------------------------
  const analisi = analizzaParametri(query)
  if (!analisi.ok) {
    if (analisi.fatale) {
      return <Esito titolo="Richiesta non valida" messaggio={analisi.descrizione} />
    }
    redirect(
      urlDiRitorno(analisi.redirectUri, {
        error: analisi.codice,
        error_description: analisi.descrizione,
        state: analisi.state,
      }),
    )
  }
  const parametri = analisi.parametri

  // --- 2. Client -----------------------------------------------------------
  const client = await leggiClient(parametri.clientId)
  if (!client) {
    return (
      <Esito
        titolo="Applicazione sconosciuta"
        messaggio="Il client che ha avviato il collegamento non risulta registrato. Rimuovi il connettore da Claude e riaggiungilo, cosi' la registrazione riparte da zero."
      />
    )
  }
  if (!client.redirect_uris.includes(parametri.redirectUri)) {
    return (
      <Esito
        titolo="Indirizzo di ritorno non riconosciuto"
        messaggio="Il redirect_uri della richiesta non e' fra quelli registrati da questa applicazione."
      />
    )
  }

  // --- 3. Sessione CRM -----------------------------------------------------
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const authUserId = claims?.claims?.sub as string | undefined
  if (!authUserId) {
    const ritorno = `${PERCORSO_AUTORIZZAZIONE}?${query.toString()}`
    redirect(`/login?redirect=${encodeURIComponent(ritorno)}`)
  }

  // --- 4. Utente e ruolo ---------------------------------------------------
  if (await deveCambiarePassword(authUserId)) {
    return (
      <Esito
        titolo="Password da aggiornare"
        messaggio="Il tuo account usa ancora una password temporanea. Entra nel CRM, impostane una definitiva e poi riprova a collegare Claude."
      />
    )
  }

  const esito = await verificaAuthUserId(authUserId)
  if (!esito.ok) {
    return <Esito titolo="Collegamento non autorizzato" messaggio={esito.descrizione} />
  }
  const identita = esito.identita

  // --- 5. Conferma ---------------------------------------------------------
  const richiesta = firmaRichiesta(parametri, authUserId, process.env.MCP_OAUTH_SIGNING_KEY)
  const urlAnnulla = urlDiRitorno(parametri.redirectUri, {
    error: "access_denied",
    error_description: "Collegamento annullato dall'utente.",
    state: parametri.state,
  })

  return (
    <AuthShell
      eyebrow="Connettore Claude"
      title="Collega il CRM a Claude"
      subtitle="Claude potra' leggere e aggiornare i dati del CRM con i tuoi permessi."
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Stai autorizzando come</p>
          <p className="mt-1 font-semibold text-[#1E3A5F]">{identita.nome || identita.email}</p>
          <p className="text-sm text-gray-600">
            {identita.email} · ruolo {identita.ruolo}
          </p>
        </div>

        <div className="flex gap-3 rounded-lg bg-[#EEF1F9] p-4 text-sm text-[#1E3A5F]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>
              Claude vedra' esattamente cio' che vedi tu: lead, clienti, compiti, scadenze,
              installatori, offerta commerciale e file.
            </p>
            <p className="text-[#1E3A5F]/80">
              Restano fuori impostazioni, ruoli e permessi, registro di audit e gestione degli
              account. Puoi revocare il collegamento in qualsiasi momento.
            </p>
          </div>
        </div>

        <form method="post" action="/api/oauth-mcp/authorize" className="space-y-3">
          <input type="hidden" name="richiesta" value={richiesta} />
          <Button
            type="submit"
            className="w-full bg-[#1E3A5F] transition-all hover:brightness-110"
          >
            Autorizza Claude
          </Button>
        </form>

        <div className="text-center">
          <a href={urlAnnulla} className="text-sm text-gray-500 hover:underline">
            Annulla
          </a>
        </div>
      </div>
    </AuthShell>
  )
}

function Esito({ titolo, messaggio }: { titolo: string; messaggio: string }) {
  return (
    <AuthShell eyebrow="Connettore Claude" title={titolo} subtitle={messaggio}>
      <p className="text-sm text-gray-600">
        Nessun accesso e' stato concesso. Puoi chiudere questa finestra e tornare a Claude.
      </p>
    </AuthShell>
  )
}
