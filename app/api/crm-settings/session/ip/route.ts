import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"

// Blocco manuale e sblocco di un indirizzo IP.
//
// Scritture con service_role: su public.ip_bloccati esiste la sola policy
// `ip_bloccati_select`, quindi con RLS attiva un INSERT o un DELETE fatto col
// client dell'utente verrebbe rifiutato sempre. Stessa forma di audit_log.
//
// Un blocco creato da qui non ha scadenza: e' una decisione di un
// amministratore e resta finche' non la revoca qualcuno. I blocchi automatici,
// scritti da lib/session-access/login-guard, hanno invece sempre una scadenza.

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6 = /^[0-9a-f:]+$/i

function ipValido(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const ip = raw.trim()
  if (ip.length === 0 || ip.length > 45) return null

  if (IPV4.test(ip)) {
    return ip.split(".").every((o) => Number(o) <= 255) ? ip : null
  }
  // Un IPv6 non viene normalizzato: si accetta la forma testuale e si confronta
  // com'e'. La colonna e' `text` e il confronto in login-guard e' un uguale
  // secco, quindi cio' che conta e' scriverlo com'e' arrivato.
  return IPV6.test(ip) && ip.includes(":") ? ip : null
}

export async function POST(request: Request) {
  const guard = await requireApiPage("crm_settings.account.session")
  if (guard.response) return guard.response

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY non configurata" },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { ip?: string; motivo?: string }
    | null

  const ip = ipValido(body?.ip)
  if (!ip) {
    return NextResponse.json({ error: "Indirizzo IP non valido" }, { status: 400 })
  }

  const motivo =
    typeof body?.motivo === "string" && body.motivo.trim()
      ? body.motivo.trim().slice(0, 200)
      : "Bloccato manualmente"

  const attore = attoreDaPermessi(guard.permissions)

  // `ip_address` e' UNIQUE: l'upsert converte un blocco automatico gia'
  // presente in blocco manuale senza scadenza, che e' esattamente cio' che si
  // intende premendo "Blocca" su un IP gia' noto.
  const { error } = await admin.from("ip_bloccati").upsert(
    {
      ip_address: ip,
      motivo,
      bloccato_da: attore.id,
      scadenza: null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "ip_address" },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    tipo_evento: "operazione_admin",
    modulo: "auth",
    descrizione: `IP ${ip} bloccato manualmente — ${motivo}`,
    esito: "success",
    attore,
    request,
  })

  const response = NextResponse.json({ ok: true })
  response.headers.set("Cache-Control", "no-store")
  return response
}

export async function DELETE(request: Request) {
  const guard = await requireApiPage("crm_settings.account.session")
  if (guard.response) return guard.response

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY non configurata" },
      { status: 500 },
    )
  }

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Id mancante" }, { status: 400 })

  // Si rilegge l'indirizzo prima di cancellare: serve al registro, e dopo la
  // DELETE non sarebbe piu' recuperabile.
  const { data: riga } = await admin
    .from("ip_bloccati")
    .select("ip_address")
    .eq("id", id)
    .maybeSingle()

  const { error } = await admin.from("ip_bloccati").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    tipo_evento: "operazione_admin",
    modulo: "auth",
    descrizione: `IP ${riga?.ip_address ?? id} sbloccato`,
    esito: "success",
    attore: attoreDaPermessi(guard.permissions),
    request,
  })

  const response = NextResponse.json({ ok: true })
  response.headers.set("Cache-Control", "no-store")
  return response
}
