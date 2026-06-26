import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      "https://solair-crm-dashboard.vercel.app/login"
    );
  }

  const { data: utente } = await supabase
    .from("utenti")
    .select("nextcloud_access_token, nextcloud_refresh_token, nextcloud_token_expires_at")
    .eq("auth_user_id", user.id)
    .single();

  // Se non connesso → avvia flusso OAuth
  if (!utente?.nextcloud_access_token) {
    return NextResponse.redirect(
      "https://solair-crm-dashboard.vercel.app/api/auth/nextcloud/connect"
    );
  }

  // Se token scaduto → refresh
  const isExpired =
    utente.nextcloud_token_expires_at &&
    new Date(utente.nextcloud_token_expires_at) < new Date();

  let accessToken = utente.nextcloud_access_token;

  if (isExpired && utente.nextcloud_refresh_token) {
    const res = await fetch(`${process.env.NEXTCLOUD_URL}/apps/oauth2/api/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: utente.nextcloud_refresh_token,
        client_id: process.env.NEXTCLOUD_CLIENT_ID!,
        client_secret: process.env.NEXTCLOUD_CLIENT_SECRET!,
      }),
    });

    const tokens = await res.json();

    if (tokens.access_token) {
      accessToken = tokens.access_token;
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
    } else {
      // Refresh fallito → riautentica
      return NextResponse.redirect(
        "https://solair-crm-dashboard.vercel.app/api/auth/nextcloud/connect"
      );
    }
  }

  // Genera app password temporanea via OCS API
  const ocsRes = await fetch(
    `${process.env.NEXTCLOUD_URL}/ocs/v2.php/core/getapppassword`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "OCS-APIRequest": "true",
      },
    }
  );

  const xml = await ocsRes.text();
  const match = xml.match(/<apppassword>(.*?)<\/apppassword>/);
  const appPassword = match?.[1];

  if (!appPassword) {
    // Fallback: riautentica
    return NextResponse.redirect(
      "https://solair-crm-dashboard.vercel.app/api/auth/nextcloud/connect"
    );
  }

  // Estrai username dal token OCS
  const userMatch = xml.match(/<loginname>(.*?)<\/loginname>/);
  const ncUsername = userMatch?.[1] ?? user.email;

  // Login diretto Nextcloud con app password temporanea
  const ncLoginUrl = `${process.env.NEXTCLOUD_URL}/login?user=${encodeURIComponent(ncUsername!)}&password=${encodeURIComponent(appPassword)}&redirect_url=/apps/files`;

  return NextResponse.redirect(ncLoginUrl);
}
