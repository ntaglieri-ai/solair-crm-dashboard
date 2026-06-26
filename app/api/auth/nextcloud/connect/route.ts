import { NextResponse } from "next/server";
 
export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NEXTCLOUD_CLIENT_ID!,
    redirect_uri: "https://solair-crm-dashboard.vercel.app/api/auth/nextcloud/callback",
  });
 
  const url = `${process.env.NEXTCLOUD_URL}/apps/oauth2/authorize?${params}`;
  return NextResponse.redirect(url);
}
 
