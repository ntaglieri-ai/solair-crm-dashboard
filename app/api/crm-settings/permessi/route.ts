import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  type RuoloColore,
  type RuoloPermessi,
} from "@/lib/ruoli-data"
import { requireApiAction } from "@/lib/permissions/server"

type PatchPayload = {
  ruoloId: string
  permessi: RuoloPermessi
}

type CreatePayload = {
  nome: string
  descrizione?: string
  colore?: RuoloColore
  permessi: RuoloPermessi
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function buildPermissionRows(ruoloId: string, permessi: RuoloPermessi) {
  const paginaRows = PAGINE.map((p) => ({
    ruolo_id: ruoloId,
    pagina: p.id,
    accesso: permessi.pagine[p.id] === true ? "rw" : "no_access",
  }))

  const recordRows = MODULI_RECORD.flatMap((m) =>
    RECORD_PERMESSI.map((perm) => ({
      ruolo_id: ruoloId,
      modulo: m.id,
      azione: perm.id,
      abilitato: permessi.record[m.id].includes(perm.id),
    })),
  )

  const uiRows = [
    {
      ruolo_id: ruoloId,
      chiave: "visibilita_sedi",
      abilitato: permessi.visibilita_sedi === "all",
    },
    {
      ruolo_id: ruoloId,
      chiave: "cartelle_nextcloud",
      abilitato: permessi.cartelle_nextcloud === "all",
    },
    {
      ruolo_id: ruoloId,
      chiave: "riconfigurazioni",
      abilitato: permessi.riconfigurazioni === true,
    },
  ]

  return { paginaRows, recordRows, uiRows }
}

async function savePermissions(ruoloId: string, permessi: RuoloPermessi) {
  const supabase = await createClient()
  const { paginaRows, recordRows, uiRows } = buildPermissionRows(ruoloId, permessi)

  const paginaRes = await supabase
    .from("permessi_pagina")
    .upsert(paginaRows, { onConflict: "ruolo_id,pagina" })
  if (paginaRes.error) return paginaRes.error

  const recordRes = await supabase
    .from("permessi_record")
    .upsert(recordRows, { onConflict: "ruolo_id,modulo,azione" })
  if (recordRes.error) return recordRes.error

  const { data: existingUiRows, error: existingUiError } = await supabase
    .from("permessi_ui")
    .select("chiave")
    .eq("ruolo_id", ruoloId)

  if (existingUiError) {
    console.warn("[crm-settings/permessi] read ui permissions warning:", existingUiError.message)
    return null
  }

  const existingUiKeys = new Set((existingUiRows ?? []).map((row) => row.chiave as string))
  const uiRowsToUpdate = uiRows.filter((row) => existingUiKeys.has(row.chiave))
  if (uiRowsToUpdate.length === 0) return null

  const uiRes = await supabase
    .from("permessi_ui")
    .upsert(uiRowsToUpdate, { onConflict: "ruolo_id,chiave" })

  if (uiRes.error) {
    console.warn("[crm-settings/permessi] save ui permissions warning:", uiRes.error.message)
  }

  return null
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.account.roles.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as CreatePayload | null
  if (!body?.nome?.trim() || !body.permessi) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: lastRole } = await supabase
    .from("ruoli")
    .select("ordinamento")
    .order("ordinamento", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const codeBase = slugify(body.nome) || "ruolo"
  const code = `${codeBase}_${Date.now()}`
  const { data: ruolo, error: ruoloError } = await supabase
    .from("ruoli")
    .insert({
      code,
      nome: body.nome.trim(),
      descrizione: body.descrizione?.trim() || null,
      colore: body.colore ?? "gray",
      ordinamento: ((lastRole?.ordinamento as number | null) ?? 0) + 1,
      sistema: false,
    })
    .select("id, nome, descrizione, colore")
    .single()

  if (ruoloError || !ruolo) {
    console.error("[crm-settings/permessi] create role error:", ruoloError?.message)
    return NextResponse.json(
      { error: "Creazione ruolo non riuscita. Riprova." },
      { status: 500 },
    )
  }

  const permissionError = await savePermissions(ruolo.id as string, body.permessi)
  if (permissionError) {
    console.error("[crm-settings/permessi] create permissions error:", permissionError.message)
    return NextResponse.json(
      { error: "Ruolo creato, ma inizializzazione permessi non riuscita." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ruolo: {
      id: ruolo.id,
      nome: ruolo.nome,
      descrizione: ruolo.descrizione ?? "",
      colore: ruolo.colore ?? "gray",
      utenti: 0,
      permessi: body.permessi,
    },
  }, { status: 201 })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAction("crm_settings.account.roles.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as PatchPayload | null
  if (!body?.ruoloId || !body.permessi) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }

  const { ruoloId, permessi } = body
  const error = await savePermissions(ruoloId, permessi)
  if (error) {
    console.error("[crm-settings/permessi] update error:", error.message)
    return NextResponse.json(
      { error: "Salvataggio permessi non riuscito. Riprova." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
