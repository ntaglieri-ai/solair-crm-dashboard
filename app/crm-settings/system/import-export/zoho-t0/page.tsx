import { redirect } from "next/navigation"
import { requirePage } from "@/lib/permissions/server"
import { ZohoT0ImportClient } from "./zoho-t0-import-client"

const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMIN"])

export default async function ZohoT0ImportPage() {
  const permissions = await requirePage("crm_settings.system.zoho_t0")
  const role = permissions.snapshot.subject.ruoloCode.toUpperCase()

  if (!ALLOWED_ROLES.has(role)) redirect("/")

  return <ZohoT0ImportClient role={role} />
}
