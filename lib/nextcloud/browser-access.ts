import { createClient } from "@/lib/supabase/server"
import { getNextcloudAppPassword } from "./credentials"
import { canAccessNcPath, loadNcPathRules, normalizeNcPath, roleRequiresExplicitNcPathRule } from "./path-permissions"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"

/** Rechecked both before logout and after returning from Nextcloud. */
export async function resolveBrowserAccess(path: string, fileId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "/login" } as const
  const { data: utente } = await supabase.from("utenti").select("id")
    .eq("auth_user_id", user.id).maybeSingle()
  if (!utente) return { error: "/documenti?nc_error=no_account" } as const
  if (!(await getNextcloudAppPassword(utente.id))) {
    return { error: "/documenti?nc_error=not_provisioned" } as const
  }
  const snapshot = await loadCurrentPermissionSnapshot()
  // Preserve the Mac implementation: agents see their explicit shares, not
  // the Solair root, which must not be shared with their group.
  let redirectPath = roleRequiresExplicitNcPathRule(snapshot.subject.ruoloCode)
    ? "/apps/files/"
    : "/apps/files/?dir=/Solair"
  const requested = normalizeNcPath(path)
  if (requested) {
    const rules = await loadNcPathRules()
    if (!canAccessNcPath(requested, snapshot.subject.ruoloCode, rules)) {
      return { error: "/documenti?nc_error=path_denied" } as const
    }
    redirectPath = fileId && /^\d+$/.test(fileId)
      ? `/f/${fileId}`
      : `/apps/files/?${new URLSearchParams({ dir: `/${requested}` })}`
  }
  return { userId: user.id, redirectPath } as const
}
