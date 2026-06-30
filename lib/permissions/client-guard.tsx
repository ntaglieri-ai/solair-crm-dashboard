"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "./provider"

export function PermissionPageGuard({
  page,
  children,
}: {
  page: string
  children: ReactNode
}) {
  const router = useRouter()
  const permissions = usePermissions()
  const allowed = permissions.canPage(page)

  useEffect(() => {
    if (!allowed) router.replace("/")
  }, [allowed, router])

  if (!allowed) return null
  return children
}
