import { redirect } from "next/navigation"

export default function MaintenancePage() {
  redirect("/crm-settings/maintenance/health")
}
