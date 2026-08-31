import { NextRequest } from "next/server"
import { switchRedirect } from "@/lib/nextcloud/session-switch"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Compatibility URL: always go through the validated, signed handoff.
  return switchRedirect(new URL("/api/auth/nextcloud/open", request.url))
}
