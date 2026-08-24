import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { applicaPerimetro } from "@/lib/mcp/denylist"
import { accessTokenVito } from "@/lib/mcp/token"

/**
 * Client Supabase del server MCP: autenticato col JWT dell'utente reale
 * (quindi RLS attiva come per una sessione normale) e avvolto dal perimetro
 * definito in lib/mcp/denylist.ts.
 */

function env(nome: string): string {
  const valore = process.env[nome]
  if (!valore) throw new Error(`Variabile d'ambiente ${nome} non configurata`)
  return valore
}

export async function creaClientMcp(): Promise<SupabaseClient> {
  const token = await accessTokenVito()
  const client = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  return applicaPerimetro(client)
}
