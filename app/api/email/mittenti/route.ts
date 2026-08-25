import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import {
  defaultSenderFor,
  getSenderPermissions,
  listSelectableSenders,
} from "@/lib/email/sender-accounts"
import { hasSystemOutboundSmtp } from "@/lib/email/lead-mailer"
import { getPersonalEmailStatus } from "@/lib/email/personal-credentials"

// Opzioni del dropdown "Invia da", per il compose singolo e per l'invio massa,
// piu' `canSend`: se l'invio e' possibile del tutto.
//
// Se il ruolo non ha puo_scegliere_mittente la risposta torna `canChoose:
// false` e NESSUN elenco: la UI non deve mostrare un menu, e non ha senso
// spedirle caselle che non potrebbe comunque usare. Il mittente resta la
// propria riga is_default, risolta lato server all'invio.

export async function GET() {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // `canSend` risponde alla domanda che i dialog facevano prima a
  // /api/profilo/email-credentials, e la faceva male: chiedeva se esistesse una
  // casella personale nel Profilo, disabilitando il pulsante di invio a chi non
  // l'aveva. Ma con l'SMTP di sistema configurato quella casella non serve —
  // l'invio parte dalle credenziali SES e dal mittente di crm_email_accounts.
  // Serve solo al fallback Aruba, che si autentica davvero su di essa.
  const systemSmtpAvailable = hasSystemOutboundSmtp()
  const canSend =
    systemSmtpAvailable || (await getPersonalEmailStatus(subject.userId)).configured

  const { puoScegliereMittente } = await getSenderPermissions(subject.userId)
  if (!puoScegliereMittente) {
    return NextResponse.json({ canSend, canChoose: false, accounts: [], defaultAccountId: null })
  }

  const accounts = await listSelectableSenders(subject.userId)
  const fallback = defaultSenderFor(accounts, subject.userId)

  return NextResponse.json({
    canSend,
    canChoose: true,
    defaultAccountId: fallback?.id ?? null,
    accounts: accounts.map((account) => ({
      id: account.id,
      nomeVisualizzato: account.nomeVisualizzato,
      email: account.email,
      condivisa: account.condivisa,
      isDefault: account.utenteId === subject.userId && account.isDefault,
    })),
  })
}
