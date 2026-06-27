import { NextResponse } from "next/server"
import { computeStats } from "@/lib/leads/repository"

export async function GET() {
  return NextResponse.json(await computeStats())
}
