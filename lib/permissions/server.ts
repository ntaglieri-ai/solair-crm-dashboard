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

export async function requireApiAction(action: string) {
  const permissions = await getCurrentPermissions()
  if (!permissions.canAction(action)) {
    return { permissions, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { permissions, response: null }
}
