// app/nextcloud/login/page.tsx
"use client"

import Image from "next/image"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  FolderLock,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BRAND_LOGO = "/solair-brand-logo.png"
const HERO_IMAGE = "/auth-solar.jpg"

function safeRedirect(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/api/auth/nextcloud/open"
  }

  const parsed = new URL(value, "https://solair.local")
  return parsed.pathname === "/api/auth/nextcloud/open" ||
    parsed.pathname === "/oauth/consent"
    ? `${parsed.pathname}${parsed.search}`
    : "/api/auth/nextcloud/open"
}

function NextcloudLoginForm() {
  const searchParams = useSearchParams()
  const sessioneScaduta = searchParams.get("sessione_scaduta") === "1"
  const postLoginRedirect = safeRedirect(searchParams.get("redirect"))
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "forgot">("login")
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let res: Response
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      setError("Impossibile contattare il server. Controlla la connessione e riprova.")
      setLoading(false)
      return
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? "Email o password non corretti.")
      setLoading(false)
      return
    }

    // Load with the cookies just issued by the server, without reusing an
    // earlier authorization response from the client router cache.
    window.location.assign(postLoginRedirect)
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

    setResetMessage(
      body?.message ??
        "Se l'indirizzo e' registrato, riceverai una email a breve con le istruzioni per accedere.",
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
    <main className="relative min-h-screen overflow-hidden bg-[#eef3f8] text-[#102033]">
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,19,31,0.92)_0%,rgba(12,43,62,0.78)_44%,rgba(238,243,248,0.9)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(0deg,rgba(238,243,248,1)_0%,rgba(238,243,248,0)_100%)]" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col gap-8 px-5 py-6 sm:min-h-[42svh] sm:justify-between sm:px-8 lg:min-h-screen lg:px-12 lg:py-10">
          <Image src={BRAND_LOGO} alt="Solair Group" width={154} height={48} className="h-12 w-auto brightness-0 invert" />

          <div className="max-w-2xl pb-3 text-white sm:pb-6 sm:pt-16 lg:pb-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#93f0d0] backdrop-blur">
              <Cloud className="size-4" />
              Solair Document Cloud
            </div>
            <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
              Accesso sicuro ai documenti Nextcloud.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/78 sm:mt-5 sm:text-lg sm:leading-7">
              Entra con il tuo account Solair e continua direttamente nelle cartelle abilitate per il tuo ruolo.
            </p>
            <div className="mt-8 hidden max-w-xl gap-3 sm:grid sm:grid-cols-2">
              <div className="rounded-lg border border-white/16 bg-white/10 p-4 backdrop-blur">
                <FolderLock className="mb-3 size-5 text-[#93f0d0]" />
                <p className="text-sm font-semibold">Cartelle governate dai permessi</p>
                <p className="mt-1 text-sm text-white/68">Vedi soltanto gli spazi documentali assegnati.</p>
              </div>
              <div className="rounded-lg border border-white/16 bg-white/10 p-4 backdrop-blur">
                <ShieldCheck className="mb-3 size-5 text-[#f4c66b]" />
                <p className="text-sm font-semibold">Sessione verificata</p>
                <p className="mt-1 text-sm text-white/68">Stesso controllo di accesso, esperienza dedicata.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 pb-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="w-full max-w-md rounded-xl border border-white/80 bg-white/94 p-6 shadow-[0_28px_90px_rgba(16,32,51,0.22)] backdrop-blur md:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2e8b72]">
                {mode === "login" ? "Accesso documentale" : "Recupero accesso"}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#1e3a5f]">
                {mode === "login" ? "Entra in Nextcloud" : "Password dimenticata?"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {mode === "login"
                  ? "Usa le credenziali Solair. Dopo il login verrai portato automaticamente su Nextcloud."
                  : "Inserisci la tua email: se corrisponde a un account, riceverai una password temporanea."}
              </p>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {sessioneScaduta ? (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle className="size-4 shrink-0" />
                    La sessione precedente e&apos; scaduta. Accedi di nuovo per continuare.
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="nextcloud-email">Email</Label>
                  <Input
                    id="nextcloud-email"
                    type="email"
                    placeholder="nome@solairgroup.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextcloud-password">Password</Label>
                  <Input
                    id="nextcloud-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                {error ? (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#244a79]" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Accesso in corso...
                    </>
                  ) : (
                    <>
                      Entra in Nextcloud
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="w-full text-center text-sm font-medium text-[#1e3a5f] hover:underline"
                >
                  Password dimenticata?
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nextcloud-reset-email">Email</Label>
                  <Input
                    id="nextcloud-reset-email"
                    type="email"
                    placeholder="nome@solairgroup.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {resetMessage ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    <CheckCircle2 className="size-4 shrink-0" />
                    {resetMessage}
                  </div>
                ) : null}

                {error ? (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#244a79]" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    "Invia password temporanea"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full text-center text-sm font-medium text-[#1e3a5f] hover:underline"
                >
                  Torna all&apos;accesso Nextcloud
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function NextcloudLoginPage() {
  return (
    <Suspense fallback={null}>
      <NextcloudLoginForm />
    </Suspense>
  )
}
