/**
 * CORS per gli endpoint pubblici consumati dal sito solairgroup.it.
 *
 * Logica e allowlist nate in /api/public/discount-code ed estratte qui quando
 * e' arrivato il secondo consumatore (/api/public/calculate-quote): due copie
 * della stessa allowlist divergono al primo dominio nuovo.
 *
 * La variabile d'ambiente resta PUBLIC_DISCOUNT_ALLOWED_ORIGINS, che e' quella
 * gia' configurata in produzione: rinominarla avrebbe spento il CORS senza
 * preavviso.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://solairgroup.it",
  "https://www.solairgroup.it",
]

export function allowedOrigins() {
  const configured = process.env.PUBLIC_DISCOUNT_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
  return configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS
}

/**
 * Header CORS per la richiesta. Origin non in allowlist: si restituisce solo
 * `Vary`, cosi' il browser blocca la risposta.
 */
export function corsHeaders(
  request: Request,
  methods = "GET, OPTIONS",
  allowHeaders = "Content-Type",
) {
  const headers: Record<string, string> = { Vary: "Origin" }
  const origin = request.headers.get("origin")?.replace(/\/$/, "")
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = methods
    headers["Access-Control-Allow-Headers"] = allowHeaders
    headers["Access-Control-Max-Age"] = "86400"
  }
  return headers
}
