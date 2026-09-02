import { NextResponse } from "next/server"
import { requireApiSuperadmin } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { salvaImpostazioniSicurezza } from "@/lib/session-access/security-settings"
import { clampTentativi, clampTimeoutMinuti } from "@/lib/session-access/constants"

// Salvataggio delle tre impostazioni di sicurezza su crm_settings.
//
// Tutte e tre hanno un effetto reale, ed e' bene sapere quale:
//   - timeout: diventa la scadenza del cookie scrm_last_activity; raggiunge le
//     sessioni gia' aperte al keepalive successivo (entro ~1 minuto);
//   - tentativi massimi e blocco IP: letti da /api/auth/login a ogni tentativo.
//
// I valori vengono ristretti agli intervalli ammessi prima di essere scritti:
// la policy su crm_settings concede ALL a `authenticated`, quindi la riga e'
// scrivibile anche fuori da questa rotta e il clamp in lettura non basta.

export async function PUT(request: Request) {
  const guard = await requireApiSuperadmin()
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as
    | { timeoutMinuti?: unknown; maxTentativi?: unknown; bloccoIpAttivo?: unknown }
    | null

  if (!body) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 })

  const impostazioni = {
    timeoutMinuti: clampTimeoutMinuti(Number(body.timeoutMinuti)),
    maxTentativi: clampTentativi(Number(body.maxTentativi)),
    bloccoIpAttivo: body.bloccoIpAttivo === true,
  }

  const { errore } = await salvaImpostazioniSicurezza(impostazioni)
  if (errore) return NextResponse.json({ error: errore }, { status: 500 })

  await logAudit({
    tipo_evento: "operazione_admin",
    modulo: "auth",
    descrizione:
      `Impostazioni di sicurezza aggiornate: timeout ${impostazioni.timeoutMinuti} min, ` +
      `max ${impostazioni.maxTentativi} tentativi, blocco IP ` +
      `${impostazioni.bloccoIpAttivo ? "attivo" : "disattivo"}`,
    esito: "success",
    attore: attoreDaPermessi(guard.permissions),
    request,
  })

  const response = NextResponse.json({ ok: true, impostazioni })
  response.headers.set("Cache-Control", "no-store")
  return response
}
