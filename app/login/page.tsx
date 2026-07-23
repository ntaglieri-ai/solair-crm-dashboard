// app/login/page.tsx
"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessioneScaduta = searchParams.get("sessione_scaduta") === "1"
  const requestedRedirect = searchParams.get("redirect")
  const postLoginRedirect =
    requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Vista corrente: form di accesso oppure recupero password self-service.
  const [mode, setMode] = useState<"login" | "forgot">("login")
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("Email o password non corretti.")
      setLoading(false)
      return
    }

    router.push(postLoginRedirect)
    router.refresh()
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResetMessage(null)

    const res = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const body = (await res.json().catch(() => null)) as { message?: string } | null

    // La risposta e' sempre neutra (200 o 429): mostriamo il messaggio cosi'
    // com'e', senza rivelare se l'indirizzo esiste.
    setResetMessage(
      body?.message ??
        "Se l'indirizzo è registrato, riceverai una email a breve con le istruzioni per accedere.",
    )
    setLoading(false)
  }

  function switchMode(next: "login" | "forgot") {
    setMode(next)
    setError(null)
    setResetMessage(null)
    setPassword("")
  }

  return (
    <AuthShell
      eyebrow={mode === "login" ? "Area riservata" : "Recupero accesso"}
      title={mode === "login" ? "Bentornato" : "Password dimenticata?"}
      subtitle={
        mode === "login"
          ? "Accedi con le tue credenziali Solair CRM."
          : "Ti mandiamo una password temporanea via email."
      }
    >
      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          {sessioneScaduta && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              La tua sessione precedente non è più valida. Accedi di nuovo con la password
              temporanea ricevuta via email.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@solairgroup.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#1E3A5F] transition-all hover:brightness-110"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accesso in corso...
              </>
            ) : (
              "Accedi"
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-sm text-[#1E3A5F] hover:underline"
            >
              Password dimenticata?
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleForgot} className="space-y-4">
          <p className="text-sm text-gray-600">
            Inserisci la tua email: se corrisponde a un account, ti invieremo una
            password temporanea per accedere.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="nome@solairgroup.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {resetMessage && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {resetMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#1E3A5F] transition-all hover:brightness-110"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Invio in corso...
              </>
            ) : (
              "Invia password temporanea"
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-sm text-[#1E3A5F] hover:underline"
            >
              Torna all&apos;accesso
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}

// useSearchParams() richiede un boundary Suspense: senza, Next.js degrada la
// pagina a fully client-rendered (o fallisce in build statica). Il fallback
// e' nullo perche' il layout sotto non dipende da dati asincroni lenti — il
// contenuto compare appena il client idrata, praticamente istantaneo.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
