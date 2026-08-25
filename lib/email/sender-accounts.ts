// Mittenti selezionabili per gli invii CRM (tabella crm_email_accounts).
//
// Il dominio solairgroup.it e' verificato per intero su SES: qualsiasi
// indirizzo @solairgroup.it puo' fare da From con le credenziali SMTP di
// sistema gia' in uso. Non esistono credenziali per casella — cambia solo
// l'header From, l'autenticazione SMTP resta una sola.
//
// Le letture passano dal service_role e il filtro "cosa posso usare" e'
// riscritto qui in codice invece di appoggiarsi alla sola RLS: questa e' la
// validazione che gira al submit, e deve valere anche se un giorno le policy
// venissero allentate.

import { createAdminClient } from "@/lib/supabase/admin"

export type EmailAccount = {
  id: string
  utenteId: string | null
  nomeVisualizzato: string
  email: string
  condivisa: boolean
  attivo: boolean
  isDefault: boolean
}

type AccountRow = {
  id: string
  utente_id: string | null
  nome_visualizzato: string
  email: string
  condivisa: boolean
  attivo: boolean
  is_default: boolean
}

const ACCOUNT_COLUMNS = "id, utente_id, nome_visualizzato, email, condivisa, attivo, is_default"

function toAccount(row: AccountRow): EmailAccount {
  return {
    id: row.id,
    utenteId: row.utente_id,
    nomeVisualizzato: row.nome_visualizzato,
    email: row.email,
    condivisa: row.condivisa,
    attivo: row.attivo,
    isDefault: row.is_default,
  }
}

export type SenderPermissions = {
  puoScegliereMittente: boolean
  puoGestireEmailAccounts: boolean
}

const NO_SENDER_PERMISSIONS: SenderPermissions = {
  puoScegliereMittente: false,
  puoGestireEmailAccounts: false,
}

/**
 * I due flag vivono su `ruoli`, non nelle tabelle permessi_* lette dal motore
 * dei permessi: si risolvono con un join esplicito utenti -> ruoli.
 */
export async function getSenderPermissions(utenteId: string | null): Promise<SenderPermissions> {
  if (!utenteId) return NO_SENDER_PERMISSIONS
  const admin = createAdminClient()
  if (!admin) return NO_SENDER_PERMISSIONS

  const { data, error } = await admin
    .from("utenti")
    .select("ruoli:ruolo_id (puo_scegliere_mittente, puo_gestire_email_accounts)")
    .eq("id", utenteId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("[mittenti] lettura permessi ruolo fallita:", error.message)
    return NO_SENDER_PERMISSIONS
  }

  // La join annidata di PostgREST torna un oggetto o un array a seconda della
  // cardinalita' dedotta dallo schema: si normalizzano entrambe le forme.
  const raw = (data as { ruoli: unknown }).ruoli
  const ruolo = (Array.isArray(raw) ? raw[0] : raw) as
    | { puo_scegliere_mittente: boolean | null; puo_gestire_email_accounts: boolean | null }
    | null
    | undefined

  return {
    puoScegliereMittente: ruolo?.puo_scegliere_mittente === true,
    puoGestireEmailAccounts: ruolo?.puo_gestire_email_accounts === true,
  }
}

/**
 * Le caselle che l'utente puo' usare come mittente: la propria piu' tutte le
 * condivise attive. Stesso insieme che la RLS espone in lettura.
 */
export async function listSelectableSenders(utenteId: string): Promise<EmailAccount[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from("crm_email_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("attivo", true)
    .or(`utente_id.eq.${utenteId},condivisa.eq.true`)
    .order("condivisa", { ascending: true })
    .order("nome_visualizzato", { ascending: true })

  if (error) {
    console.error("[mittenti] elenco caselle selezionabili fallito:", error.message)
    return []
  }

  return ((data ?? []) as AccountRow[]).map(toAccount)
}

/**
 * La casella proposta di default: la riga is_default dell'utente. Chi non ne
 * ha una (utente senza casella propria) parte senza preselezione e ricade sul
 * mittente di sistema, cioe' sul comportamento precedente a questa feature.
 */
export function defaultSenderFor(accounts: EmailAccount[], utenteId: string): EmailAccount | null {
  return accounts.find((account) => account.utenteId === utenteId && account.isDefault) ?? null
}

export type ResolvedSender = {
  /** From da passare al transport, `null` per lasciare il mittente di sistema. */
  fromEmail: string | null
  fromName: string | null
  accountId: string | null
}

export type ResolveSenderResult =
  | { ok: true; sender: ResolvedSender }
  | { ok: false; error: string }

/**
 * Validazione al submit del mittente arrivato dal client. Il dropdown lato UI
 * non e' una garanzia: l'endpoint e' raggiungibile direttamente, quindi qui si
 * ricontrolla sia il permesso di ruolo sia l'appartenenza della casella
 * all'insieme selezionabile.
 *
 * Senza `accountId` non e' un errore: si torna la casella di default
 * dell'utente, e se non ne ha si lascia decidere al chiamante (mittente di
 * sistema, comportamento invariato).
 */
export async function resolveSender(params: {
  utenteId: string
  accountId?: string | null
}): Promise<ResolveSenderResult> {
  const accounts = await listSelectableSenders(params.utenteId)

  if (!params.accountId) {
    const fallback = defaultSenderFor(accounts, params.utenteId)
    return {
      ok: true,
      sender: fallback
        ? { fromEmail: fallback.email, fromName: fallback.nomeVisualizzato, accountId: fallback.id }
        : { fromEmail: null, fromName: null, accountId: null },
    }
  }

  const { puoScegliereMittente } = await getSenderPermissions(params.utenteId)
  if (!puoScegliereMittente) {
    return { ok: false, error: "Il tuo ruolo non puo' scegliere il mittente." }
  }

  const chosen = accounts.find((account) => account.id === params.accountId)
  if (!chosen) {
    return { ok: false, error: "La casella mittente selezionata non e' disponibile." }
  }

  return {
    ok: true,
    sender: { fromEmail: chosen.email, fromName: chosen.nomeVisualizzato, accountId: chosen.id },
  }
}
