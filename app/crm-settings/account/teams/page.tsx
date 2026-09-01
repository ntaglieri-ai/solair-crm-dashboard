import { requirePage } from "@/lib/permissions/server"
import { TeamManagementClient } from "./team-management-client"

export default async function TeamsPage() {
  const permissions = await requirePage("crm_settings.account")
  if (!permissions.canAction("crm_settings.account.users.manage")) return null
  return <TeamManagementClient />
}
