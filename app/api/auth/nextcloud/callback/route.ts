import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect("/documenti?error=no_code");

  // Scambia code con token
  const res = await fetch(`${process.env.NEXTCLOUD_URL}/apps/oauth2/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.NEXTCLOUD_CLIENT_ID!,
      client_secret: process.env.NEXTCLOUD_CLIENT_SECRET!,
      redirect_uri: "https://solair-crm-dashboard.vercel.app/api/auth/nextcloud/callback",
    }),
  });

  const tokens = await res.json();

  if (!tokens.access_token) {
    return NextResponse.redirect(
      "https://solair-crm-dashboard.vercel.app/documenti?error=token_failed"
    );
  }

  // Salva token su Supabase per l'utente corrente
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      "https://solair-crm-dashboard.vercel.app/documenti?error=no_user"
    );
  }

  await supabase
    .from("utenti")
    .update({
      nextcloud_access_token: tokens.access_token,
      nextcloud_refresh_token: tokens.refresh_token,
      nextcloud_token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
    })
    .eq("auth_user_id", user.id);

  return NextResponse.redirect(
    "https://solair-crm-dashboard.vercel.app/documenti?connected=true"
  );
}
