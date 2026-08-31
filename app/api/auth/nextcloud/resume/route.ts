import { NextRequest, NextResponse } from "next/server"
import {
  NEXTCLOUD_RESUME_COOKIE,
  decodeNextcloudResume,
  clearNextcloudResumeCookie,
} from "@/lib/nextcloud/session-resume"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const resume = decodeNextcloudResume(
    request.cookies.get(NEXTCLOUD_RESUME_COOKIE)?.value,
  )
  const url = new URL("/api/auth/nextcloud/open", request.url)
  url.searchParams.set("nc_clean", "1")
  if (resume?.path) url.searchParams.set("path", resume.path)
  if (resume?.fileid) url.searchParams.set("fileid", resume.fileid)

  const response = NextResponse.redirect(url)
  clearNextcloudResumeCookie(response)
  return response
}
