import { NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  type RuoloColore,
  type RuoloPermessi,
} from "@/lib/ruoli-data"
import { invalidateRolePermissionCache } from "@/lib/permissions/load-permissions"
import { requireApiAction } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"

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
      chiave: "riconfigurazioni",
      abilitato: permessi.riconfigurazioni === true,
    },
    ...Object.entries(permessi.scope_dati ?? {}).flatMap(([risorsa, selected]) =>
      (["none", "own", "assigned", "team", "all"] as const).map((scope) => ({
        ruolo_id: ruoloId,
        chiave: `scope:${risorsa}:${scope}`,
        abilitato: scope === selected,
      })),
    ),
  ]

  const actionRows = Object.entries(permessi.azioni ?? {}).map(
    ([azione, abilitato]) => ({
      ruolo_id: ruoloId,
      azione,
      abilitato: abilitato === true,
    }),
  )

  const fieldRows = Object.entries(permessi.campi ?? {}).flatMap(
    ([modulo, fields]) =>
      Object.entries(fields).map(([campo, accesso]) => ({
        ruolo_id: ruoloId,
        modulo,
        campo,
        campo_nome: campo,
        accesso,
      })),
  )

  return { paginaRows, recordRows, uiRows, actionRows, fieldRows }
}

async function savePermissions(ruoloId: string, permessi: RuoloPermessi) {
  const supabase = await createClient()
  const { paginaRows, recordRows, uiRows, actionRows, fieldRows } =
    buildPermissionRows(ruoloId, permessi)

  const paginaRes = await supabase
    .from("permessi_pagina")
    .upsert(paginaRows, { onConflict: "ruolo_id,pagina" })
  if (paginaRes.error) return paginaRes.error

  const recordRes = await supabase
    .from("permessi_record")
    .upsert(recordRows, { onConflict: "ruolo_id,modulo,azione" })
  if (recordRes.error) return recordRes.error

  // permessi_ui si scrive per upsert diretto, senza prima leggere quali chiavi
  // esistono gia'.
  //
  // Il giro di lettura precedente era la causa del salvataggio che non salvava:
  // con la RLS deny-all (nessuna policy, vedi 20260824e) la SELECT non
  // falliva, tornava zero righe senza errore. Da li' il codice concludeva
  // "nessuna chiave da aggiornare" e usciva con `return null` — cioe' successo
  // — saltando anche tutte le scritture successive: permessi_campo,
  // permessi_azione e la pulizia delle righe jolly.
  //
  // Non e' solo un problema di RLS: l'uscita anticipata sbagliava comunque per
  // un ruolo nuovo, che di righe in permessi_ui non ne ha ancora nessuna e
  // quindi non ne avrebbe mai ricevuta una. L'upsert le crea e le aggiorna
  // senza doverlo sapere in anticipo.
  const uiRes = await supabase
    .from("permessi_ui")
    .upsert(uiRows, { onConflict: "ruolo_id,chiave" })

  // Errore riportato al chiamante e non solo su console: un permesso di UI che
  // non si scrive e' un permesso che l'amministratore crede di aver dato.
  if (uiRes.error) return uiRes.error

  // permessi_azione e permessi_campo NON sono opzionali: sono la parte della
  // configurazione che decide cosa un ruolo vede a schermo. Un loro fallimento
  // deve risalire, non finire in un console.warn che nessuno legge.
  //
  // permessi_scope non compare piu': la tabella non esiste nello schema remoto
  // e non e' stata creata di proposito. Lo scope per risorsa ha gia' due vie
  // che funzionano — il default del ruolo in lib/permissions/constants.ts e le
  // chiavi `visibilita_sedi` / `scope:<risorsa>:<scope>` di permessi_ui — e il
  // pannello Permessi lo mostra in sola lettura, senza alcun controllo per
  // cambiarlo. Una terza tabella sarebbe schema per una funzione che nessuno
  // puo' configurare.
  if (actionRows.length > 0) {
    const res = await supabase
      .from("permessi_azione")
      .upsert(actionRows, { onConflict: "ruolo_id,azione" })
    if (res.error) return res.error
  }

  if (fieldRows.length > 0) {
    const res = await supabase
      .from("permessi_campo")
      .upsert(fieldRows, { onConflict: "ruolo_id,modulo,campo" })
    if (res.error) return res.error
  }

  if (fieldRows.length > 0) {
    const deleteWildcard = await supabase
      .from("permessi_campo")
      .delete()
      .eq("ruolo_id", ruoloId)
      .eq("campo", "*")

    // Se la riga jolly resta, continua a vincere sulle regole per campo appena
    // salvate: e' un fallimento che cambia il risultato, non un avviso.
    if (deleteWildcard.error) return deleteWildcard.error
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
    .select("id, code, nome, descrizione, colore")
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
  invalidateRolePermissionCache(ruolo.id as string)

  after(() =>
    logAudit({
      tipo_evento: "operazione_admin",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "permessi",
      record_id: ruolo.id as string,
      descrizione: `Nuovo ruolo creato — ${ruolo.nome}`,
      request,
    }),
  )

  return NextResponse.json({
    ruolo: {
      id: ruolo.id,
      code: ruolo.code,
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
  invalidateRolePermissionCache(ruoloId)

  after(async () =>
    logAudit({
      tipo_evento: "operazione_admin",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "permessi",
      record_id: ruoloId,
      descrizione: await descriviRuolo(ruoloId),
      request,
    }),
  )

  return NextResponse.json({ ok: true })
}

/**
 * Nome del ruolo per la descrizione dell'evento. La matrice dei permessi e'
 * troppo grande per finire in `descrizione`: chi indaga parte da qui e apre il
 * ruolo per il dettaglio.
 */
async function descriviRuolo(ruoloId: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("ruoli")
      .select("nome")
      .eq("id", ruoloId)
      .maybeSingle()
    return data?.nome
      ? `Permessi del ruolo "${data.nome}" aggiornati`
      : "Permessi di un ruolo aggiornati"
  } catch {
    return "Permessi di un ruolo aggiornati"
  }
}
