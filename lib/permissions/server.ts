import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { pageKeyFromPath } from "./constants"
import { createPermissionEngine } from "./engine"
import { loadCurrentPermissionSnapshot } from "./load-permissions"

export async function getCurrentPermissions() {
  return createPermissionEngine(await loadCurrentPermissionSnapshot())
}

export async function requirePage(page: string, redirectTo = "/") {
  const permissions = await getCurrentPermissions()
  if (!permissions.canPage(page)) redirect(redirectTo)
  return permissions
}

export async function requirePathname(pathname: string, redirectTo = "/") {
  const page = pageKeyFromPath(pathname)
  if (!page) return getCurrentPermissions()
  return requirePage(page, redirectTo)
}

export async function requireSuperadmin(redirectTo = "/") {
  const permissions = await getCurrentPermissions()
  if (!permissions.isSuperadmin) redirect(redirectTo)
  return permissions
}

export async function requireApiPage(page: string) {
  const permissions = await getCurrentPermissions()
  if (!permissions.canPage(page)) {
    return { permissions, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { permissions, response: null }
}

export async function requireApiRecord(module: string, action: string) {
  const permissions = await getCurrentPermissions()
  if (!permissions.canRecord(module, action)) {
    return { permissions, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { permissions, response: null }
}

/**
 * Guard per le operazioni che non appartengono a nessun modulo e non vanno
 * concesse per permesso: solo il ruolo SUPERADMIN passa.
 *
 * Serve dove il permesso granulare sarebbe fuorviante — spegnere il blocco
 * degli invii senza consenso non e' "gestire le comunicazioni", e non deve
 * poter finire in un ruolo operativo per una spunta messa distrattamente in
 * Impostazioni permessi.
 */
export async function requireApiSuperadmin() {
  const permissions = await getCurrentPermissions()
  if (permissions.snapshot.subject.ruoloCode !== "SUPERADMIN") {
    return { permissions, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { permissions, response: null }
}

export async function requireApiAction(action: string) {
  const permissions = await getCurrentPermissions()
  if (!permissions.canAction(action)) {
    return { permissions, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { permissions, response: null }
}
