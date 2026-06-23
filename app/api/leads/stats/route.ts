import { NextResponse } from "next/server"
import { computeStats } from "@/lib/leads/repository"

// GET /api/leads/stats — aggregazioni leggere (solo conteggi, mai righe).
export async function GET() {
  return NextResponse.json(computeStats())
}
