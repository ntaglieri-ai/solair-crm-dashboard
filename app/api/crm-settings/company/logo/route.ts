import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "company-assets"
const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

export async function POST(request: Request) {
  const guard = await requireApiAction("company.profile.edit")
  if (guard.response) return guard.response

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Seleziona un file immagine." }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Il logo non può superare 2 MB." }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Storage server non configurato." },
      { status: 503 },
    )
  }

  const buckets = await admin.storage.listBuckets()
  if (buckets.error) {
    return NextResponse.json({ error: buckets.error.message }, { status: 500 })
  }
  if (!buckets.data.some((bucket) => bucket.name === BUCKET)) {
    const created = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    })
    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 500 })
    }
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png"
  const path = `logo/company-logo-${Date.now()}.${extension}`
  const uploaded = await admin.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    })
  if (uploaded.error) {
    return NextResponse.json({ error: uploaded.error.message }, { status: 500 })
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
