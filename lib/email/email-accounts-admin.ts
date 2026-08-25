// Guard condivisa dalle route di gestione delle caselle condivise
// (app/api/crm-settings/email-accounts/**).
//
// Vive in lib/ e non dentro un route.ts perche' l'App Router valida gli export
// dei moduli route: da li' possono uscire solo gli handler HTTP.

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { getSenderPermissions } from "./sender-accounts"

/** Colonne restituite dalle route CRUD, identiche in lettura e scrittura. */
export const SHARED_ACCOUNT_COLUMNS =
  "id, utente_id, nome_visualizzato, email, condivisa, attivo, is_default"

type Guard =
  | { response: NextResponse; admin?: undefined; utenteId?: undefined }
  | {
      response: null
      admin: NonNullable<ReturnType<typeof createAdminClient>>
      utenteId: string
    }

/**
 * Passa solo chi ha ruoli.puo_gestire_email_accounts. Il flag vive su `ruoli`
 * e non nelle tabelle permessi_*, quindi non e' nello snapshot del motore dei
 * permessi: si risolve con getSenderPermissions().
 */
export async function requireEmailAccountManager(): Promise<Guard> {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { puoGestireEmailAccounts } = await getSenderPermissions(subject.userId)
  if (!puoGestireEmailAccounts) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const admin = createAdminClient()
  if (!admin) {
    return {
      response: NextResponse.json(
        { error: "Supabase service role non configurato" },
        { status: 500 },
      ),
    }
  }

  return { response: null, admin, utenteId: subject.userId }
}
