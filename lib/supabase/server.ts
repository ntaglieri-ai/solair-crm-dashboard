// lib/supabase/server.ts
// Client Supabase server-side con gestione cookies per Auth.
// Funziona in Server Components, Route Handlers e Server Actions.
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

/**
 * `headers` inoltra intestazioni alla API di Supabase Auth.
 *
 * Serve a un caso solo, ma importante: da quando il login avviene lato server
 * (/api/auth/login), la richiesta che GoTrue vede parte dal nostro server, non
 * dal browser. Senza inoltro, auth.sessions registrerebbe "node" come
 * user_agent e l'IP di uscita del server come indirizzo — e la tabella
 * "Sessioni attive" mostrerebbe la stessa postazione fittizia per tutti.
 * Passando lo User-Agent e l'X-Forwarded-For originali, la riga torna a
 * descrivere la postazione reale di chi si e' collegato.
 */
export async function createClient(options?: { headers?: Record<string, string> }) {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(options?.headers ? { global: { headers: options.headers } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorato in Server Components read-only
          }
        },
      },
    }
  )
}
