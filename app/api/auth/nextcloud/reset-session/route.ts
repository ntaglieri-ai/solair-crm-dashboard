import { NextResponse } from "next/server"

import { nextcloudBaseUrl } from "@/lib/nextcloud/config"

export const dynamic = "force-dynamic"

export async function GET() {
  const logoutUrl = new URL("/apps/user_oidc/sls", nextcloudBaseUrl())
  return NextResponse.redirect(logoutUrl)
}
