import { requirePage } from "@/lib/permissions/server"
import { buildDefaultPermissionSnapshot, normalizeRoleCode } from "@/lib/permissions/constants"
import { createClient } from "@/lib/supabase/server"
import type { RuoloColore } from "@/lib/ruoli-data"
import { SolairAiPermessiClient } from "./solair-ai-permessi-client"

export const dynamic = "force-dynamic"

type RuoloRow = {
  id: string
  code: string | null
  nome: string
  colore: string | null
  ordinamento: number | null
}

const COLORI_INTEGRATI: Record<string, RuoloColore> = {
  SUPERADMIN: "violet",
  ADMIN: "navy",
  DIRECTOR: "amber",
  STANDARD: "teal",
  AGENT: "rose",
}

function toColore(valore: string | null, code: string | null): RuoloColore {
  const integrato = COLORI_INTEGRATI[(code ?? "").toUpperCase()]
  if (integrato) return integrato
  const supportati: RuoloColore[] = ["navy", "teal", "gray", "violet", "amber", "rose"]
  return supportati.includes(valore as RuoloColore) ? (valore as RuoloColore) : "gray"
}

export default async function SolairAiPermessiPage() {
  const permissions = await requirePage("crm_settings.system.solair_ai.permessi")
  const supabase = await createClient()

  const [{ data: ruoli }, { data: permessiPagina }, { data: permessiAzione }] =
    await Promise.all([
      supabase
        .from("ruoli")
        .select("id, code, nome, colore, ordinamento")
        .order("ordinamento", { ascending: true }),
      supabase.from("permessi_pagina").select("ruolo_id, accesso").eq("pagina", "solair_ai"),
      supabase
        .from("permessi_azione")
        .select("ruolo_id, azione, abilitato")
        .in("azione", ["solair_ai.run", "solair_ai.revisioni.view"]),
    ])

  const righeRuoli = ((ruoli as RuoloRow[] | null) ?? []).map((riga) => ({
    id: riga.id,
    code: riga.code,
    nome: riga.nome,
    colore: toColore(riga.colore, riga.code),
  }))

  const salvatoMenu = new Map(
    ((permessiPagina as { ruolo_id: string; accesso: string | boolean | null }[] | null) ?? []).map(
      (riga) => [
        riga.ruolo_id,
        riga.accesso === true || riga.accesso === "r" || riga.accesso === "rw",
      ],
    ),
  )
  const salvatoAzione = new Map<string, boolean>()
  for (const riga of ((permessiAzione as
    | { ruolo_id: string; azione: string; abilitato: boolean }[]
    | null) ?? [])) {
    salvatoAzione.set(`${riga.ruolo_id}|${riga.azione}`, riga.abilitato === true)
  }

  // Dove non c'e' una riga salvata si mostra il default del ruolo, non uno
  // "spento" che sarebbe falso: SUPERADMIN, ADMIN e DIRECTOR nascono con
  // SolairAI acceso, ed e' quello che il database applica finche' nessuno
  // salva da questa pagina.
  const iniziali = righeRuoli.map((ruolo) => {
    const predefinito = buildDefaultPermissionSnapshot({
      ruoloCode: normalizeRoleCode(ruolo.code ?? undefined),
    })
    return {
      ruoloId: ruolo.id,
      menu: salvatoMenu.get(ruolo.id) ?? predefinito.pages.solair_ai === "rw",
      run: salvatoAzione.get(`${ruolo.id}|solair_ai.run`) ?? predefinito.actions["solair_ai.run"] === true,
      revisioni:
        salvatoAzione.get(`${ruolo.id}|solair_ai.revisioni.view`) ??
        predefinito.actions["solair_ai.revisioni.view"] === true,
    }
  })

  return (
    <SolairAiPermessiClient
      ruoli={righeRuoli}
      iniziali={iniziali}
      canManage={permissions.canAction("crm_settings.account.roles.manage")}
    />
  )
}
