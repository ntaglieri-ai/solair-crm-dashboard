import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { applyOwnerScope, resolveOwnerScope } from "@/lib/permissions/data-scope"
import {
  patternRicercaGlobale,
  RICERCA_GLOBALE_MIN_CARATTERI,
  type RisultatoRicercaGlobale,
} from "@/lib/shared/ricerca-globale"

/** Quanti risultati al massimo per ciascun modulo. */
const LIMITE_PER_MODULO = 5

function primoNonVuoto(...valori: unknown[]): string | null {
  for (const valore of valori) {
    if (typeof valore === "string" && valore.trim()) return valore.trim()
  }
  return null
}

/**
 * Ricerca globale della barra laterale: cerca in parallelo fra Clienti, Lead
 * e Installatori sui campi su cui gia' cercano le rispettive liste.
 *
 * Non e' una delle due route `correlabili` gemelle perche' quelle hanno una
 * guardia sola, buona per il loro contesto (creare un compito, collegare un
 * evento): qui invece il risultato e' un link a una scheda, quindi ogni
 * modulo va autorizzato per conto suo e chi non puo' aprire i Clienti non
 * ne deve vedere neanche i nomi. Un modulo negato sparisce dai risultati
 * senza far fallire gli altri.
 */
export async function GET(request: Request) {
  const permissions = await getCurrentPermissions()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  if (q.length < RICERCA_GLOBALE_MIN_CARATTERI) return NextResponse.json({ results: [] })

  const pattern = patternRicercaGlobale(q)
  if (!pattern) return NextResponse.json({ results: [] })

  // Aprire la scheda richiede sia la pagina (guardia delle route /clienti/[id]
  // e sorelle) sia il permesso di lettura del modulo (guardia delle API di
  // lista): un risultato mostrato senza entrambi porterebbe a un redirect.
  const puoVedere = (pagina: string, modulo: string) =>
    permissions.canPage(pagina) && permissions.canRecord(modulo, "view")

  const vediClienti = puoVedere("clienti", "clienti")
  const vediLead = puoVedere("lead", "lead")
  const vediInstallatori = puoVedere("installatori", "installatori")
  if (!vediClienti && !vediLead && !vediInstallatori) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const snapshot = permissions.snapshot

  const [clienti, leads, installatori] = await Promise.all([
    vediClienti
      ? resolveOwnerScope(snapshot, "clienti").then((scope) =>
          applyOwnerScope(
            supabase
              .from("clienti")
              .select("id, nome_clienti, email, cellulare")
              .or(`nome_clienti.ilike.${pattern},email.ilike.${pattern},cellulare.ilike.${pattern}`)
              .order("nome_clienti", { ascending: true })
              .limit(LIMITE_PER_MODULO),
            "clienti_proprietario_id",
            scope,
          ),
        )
      : null,
    vediLead
      ? resolveOwnerScope(snapshot, "lead").then((scope) =>
          applyOwnerScope(
            supabase
              .from("leads")
              .select("id, nome_lead, email, telefono, mobile_fisso")
              .or(
                `nome_lead.ilike.${pattern},email.ilike.${pattern},telefono.ilike.${pattern},mobile_fisso.ilike.${pattern}`,
              )
              .order("nome_lead", { ascending: true })
              .limit(LIMITE_PER_MODULO),
            "lead_proprietario_id",
            scope,
          ),
        )
      : null,
    vediInstallatori
      ? resolveOwnerScope(snapshot, "installatori").then((scope) =>
          applyOwnerScope(
            supabase
              .from("installatori")
              .select("id, nome, email, telefono")
              .or(`nome.ilike.${pattern},email.ilike.${pattern},telefono.ilike.${pattern}`)
              .order("nome", { ascending: true })
              .limit(LIMITE_PER_MODULO),
            "proprietario_id",
            scope,
          ),
        )
      : null,
  ])

  if (clienti?.error) console.error("[api/search/globale] clienti:", clienti.error.message)
  if (leads?.error) console.error("[api/search/globale] leads:", leads.error.message)
  if (installatori?.error) {
    console.error("[api/search/globale] installatori:", installatori.error.message)
  }

  const results: RisultatoRicercaGlobale[] = [
    ...(clienti?.data ?? []).map((row) => ({
      tipo: "cliente" as const,
      id: row.id as string,
      nome: primoNonVuoto(row.nome_clienti) ?? "(senza nome)",
      dettaglio: primoNonVuoto(row.email, row.cellulare),
      href: `/clienti/${row.id as string}`,
    })),
    ...(leads?.data ?? []).map((row) => ({
      tipo: "lead" as const,
      id: row.id as string,
      nome: primoNonVuoto(row.nome_lead) ?? "(senza nome)",
      dettaglio: primoNonVuoto(row.email, row.telefono, row.mobile_fisso),
      href: `/leads/${row.id as string}`,
    })),
    ...(installatori?.data ?? []).map((row) => ({
      tipo: "installatore" as const,
      id: row.id as string,
      nome: primoNonVuoto(row.nome) ?? "(senza nome)",
      dettaglio: primoNonVuoto(row.email, row.telefono),
      href: `/installatori/${row.id as string}`,
    })),
  ]

  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } })
}
