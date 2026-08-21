import { NextResponse } from "next/server"
import { setCrmSessionCookies, sessionIdleTimeoutSeconds } from "@/lib/auth/session-policy"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const response = NextResponse.json({
    ok: true,
    timeoutSeconds: sessionIdleTimeoutSeconds(),
  })
  response.headers.set("Cache-Control", "no-store")
  setCrmSessionCookies(response)
  return response
}
