import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { ensureFolder, uploadFile } from "@/lib/nextcloud/webdav"
import { OFFERTA_COMMERCIALE_ROOT } from "@/lib/offerta-commerciale/store"
import { commercialNextcloudUser } from "@/lib/offerta-commerciale/nextcloud-user"

export const runtime = "nodejs"
export const maxDuration = 60

const CATEGORIES = {
  listini: { folder: "Listini", extensions: ["pdf"] },
  offerte: { folder: "Offerte-del-periodo", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] },
  schede: { folder: "Schede-tecniche", extensions: ["pdf"] },
} as const

const MAX_FILE_BYTES = 25 * 1024 * 1024

function safeFileName(value: string) {
  return value
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) ?? ""
}

export async function POST(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  let nextcloud: Awaited<ReturnType<typeof commercialNextcloudUser>>
  try {
    nextcloud = await commercialNextcloudUser(guard.permissions.snapshot.subject)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account Nextcloud non disponibile" }, { status: 409 })
  }

  const form = await request.formData().catch(() => null)
  const category = form?.get("category")
  const file = form?.get("file")
  if (typeof category !== "string" || !(category in CATEGORIES) || !(file instanceof File)) {
    return NextResponse.json({ error: "Categoria o file non valido" }, { status: 400 })
  }

  const config = CATEGORIES[category as keyof typeof CATEGORIES]
  const name = safeFileName(file.name)
  const extension = name.split(".").pop()?.toLowerCase() ?? ""
  if (!name || !config.extensions.includes(extension as never)) {
    return NextResponse.json(
      { error: `Formato non consentito. Ammessi: ${config.extensions.join(", ")}` },
      { status: 400 },
    )
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Il file deve avere dimensione massima di 25 MB" }, { status: 400 })
  }

  const folder = `${OFFERTA_COMMERCIALE_ROOT}/${config.folder}`
  try {
    await ensureFolder(nextcloud.username, nextcloud.appPassword, folder)
    await uploadFile(nextcloud.username, nextcloud.appPassword, `${folder}/${name}`, Buffer.from(await file.arrayBuffer()), file.type || undefined)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload Nextcloud fallito" }, { status: 502 })
  }
  return NextResponse.json({ ok: true, nome: name, path: `${folder}/${name}` }, { status: 201 })
}
