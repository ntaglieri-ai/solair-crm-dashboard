// Rate-limiter in-memory minimale: fixed window per chiave. Sufficiente come
// protezione "best effort" contro spam su endpoint pubblici (es. reset
// password). Attenzione: la mappa vive nel processo, quindi su ambienti
// serverless multi-istanza (Vercel) il conteggio non e' condiviso tra le
// istanze — va bene per rallentare l'abuso, non e' un limite di sicurezza
// forte. Se in futuro servisse robustezza, sostituire con un backend condiviso
// (Redis/Upstash o una tabella su Postgres).
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Ritorna true se la richiesta e' consentita (sotto la soglia), false se il
 * limite per la chiave e' stato superato nella finestra corrente.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now }
  }

  existing.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

// Pulizia opportunistica delle chiavi scadute per evitare crescita illimitata
// della mappa in processi long-lived.
export function sweepExpired(): void {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}
