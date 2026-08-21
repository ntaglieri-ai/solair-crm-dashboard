import { createClient } from "@/lib/supabase/server"
import { clearCrmSessionCookies } from "@/lib/auth/session-policy"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "https://solair-crm-dashboard.vercel.app"))
  clearCrmSessionCookies(response)
  return response
}
