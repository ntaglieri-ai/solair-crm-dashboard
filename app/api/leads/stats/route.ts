import { NextResponse } from "next/server"
import { computeStats } from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"

export async function GET() {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  return NextResponse.json(await computeStats())
}
