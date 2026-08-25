import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import {
  defaultSenderFor,
  getSenderPermissions,
  listSelectableSenders,
} from "@/lib/email/sender-accounts"

// Opzioni del dropdown "Invia da", per il compose singolo e per l'invio massa.
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

  const { puoScegliereMittente } = await getSenderPermissions(subject.userId)
  if (!puoScegliereMittente) {
    return NextResponse.json({ canChoose: false, accounts: [], defaultAccountId: null })
  }

  const accounts = await listSelectableSenders(subject.userId)
  const fallback = defaultSenderFor(accounts, subject.userId)

  return NextResponse.json({
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
