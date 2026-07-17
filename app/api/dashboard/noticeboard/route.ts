import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import type { NoticeboardItem } from "@/components/dashboard/noticeboard"

const KEY = "dashboard.noticeboard"
const MANAGER_ROLES = new Set(["SUPERADMIN", "ADMIN", "DIRECTOR"])

function cutoffDate() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  return cutoff
}

function validItems(value: unknown): value is NoticeboardItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.body === "string" &&
        typeof item.author === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.pinned === "boolean",
    )
  )
}

export async function PUT(request: Request) {
  const permissions = await getCurrentPermissions()
  if (!MANAGER_ROLES.has(permissions.snapshot.subject.ruoloCode)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { items?: unknown } | null
  if (!body || !validItems(body.items) || body.items.length > 30) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }

  const cutoff = cutoffDate().getTime()
  const items = body.items
    .filter((item) => new Date(item.createdAt).getTime() >= cutoff)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

  const supabase = await createClient()
  const { error } = await supabase.from("crm_settings").upsert(
    {
      chiave: KEY,
      valore: items,
      descrizione: "Comunicazioni della bacheca aziendale",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chiave" },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
