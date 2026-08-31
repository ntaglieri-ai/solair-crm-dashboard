import type { NextResponse } from "next/server"

export const NEXTCLOUD_RESUME_COOKIE = "scrm_nc_resume"

type NextcloudResume = {
  path?: string
  fileid?: string
}

export function encodeNextcloudResume(input: NextcloudResume): string {
  return encodeURIComponent(JSON.stringify(input))
}

export function decodeNextcloudResume(value: string | undefined): NextcloudResume | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>
    const path = typeof parsed.path === "string" ? parsed.path : undefined
    const fileid =
      typeof parsed.fileid === "string" && /^\d+$/.test(parsed.fileid)
        ? parsed.fileid
        : undefined
    return { path, fileid }
  } catch {
    return null
  }
}

export function setNextcloudResumeCookie(
  response: NextResponse,
  input: NextcloudResume,
) {
  response.cookies.set(NEXTCLOUD_RESUME_COOKIE, encodeNextcloudResume(input), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 120,
    path: "/",
  })
}

export function clearNextcloudResumeCookie(response: NextResponse) {
  response.cookies.set(NEXTCLOUD_RESUME_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
}
