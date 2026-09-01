import { NextResponse } from "next/server"
import type { LeadSignalDetails } from "@/lib/leads/api-types"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  const { id } = await params
  const canAccess = await canAccessOwnedRecord(
    guard.permissions.snapshot,
    "lead",
    "leads",
    "lead_proprietario_id",
    id,
  )
  if (!canAccess) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  }

  const supabase = await createClient()
  const [notesResult, tasksResult] = await Promise.all([
    supabase
      .from("attivita")
      .select("id,testo,created_at")
      .eq("record_tipo", "lead")
      .eq("record_id", id)
      .eq("tipo", "nota")
      .order("created_at", { ascending: false }),
    supabase
      .from("compiti")
      .select("id,oggetto,scadenza,priorita,stato")
      .eq("correlato_tipo", "lead")
      .eq("correlato_id", id)
      .neq("stato", "Completato")
      .order("scadenza", { ascending: true, nullsFirst: false }),
  ])

  if (notesResult.error || tasksResult.error) {
    const message =
      notesResult.error?.message ??
      tasksResult.error?.message ??
      "Errore nel caricamento dei dettagli"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const payload: LeadSignalDetails = {
    notes: (notesResult.data ?? []).map((item) => ({
      id: item.id as string,
      text: item.testo ?? "",
      createdAt: item.created_at ?? "",
    })),
    tasks: (tasksResult.data ?? []).map((item) => ({
      id: item.id as string,
      title: item.oggetto ?? "",
      dueDate: item.scadenza ?? "",
      priority: item.priorita ?? "Medio",
      status: item.stato ?? "Non iniziato",
    })),
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
