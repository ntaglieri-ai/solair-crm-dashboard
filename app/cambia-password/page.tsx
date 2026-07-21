// app/cambia-password/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"

const MIN_LENGTH = 8

export default function CambiaPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`La password deve avere almeno ${MIN_LENGTH} caratteri.`)
      return
    }
    if (password !== confirm) {
      setError("Le due password non coincidono.")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      // Caso "sessione vecchia ancora presente nel browser ma revocata lato
      // Supabase" (tipico dopo un reset password: il refresh token della
      // vecchia sessione viene invalidato, ma il token in memoria nel
      // browser resta leggibile finche' non si prova un'operazione reale).
      // Invece di mostrare l'errore tecnico grezzo, ripuliamo la sessione
      // residua e rimandiamo al login con un messaggio chiaro.
      const isStaleSession =
        updateError.message.toLowerCase().includes("session") ||
        updateError.message.toLowerCase().includes("auth session missing")
      if (isStaleSession) {
        await supabase.auth.signOut()
        router.push("/login?sessione_scaduta=1")
        router.refresh()
        return
      }
      setError(updateError.message)
      setLoading(false)
      return
    }

    const res = await fetch("/api/auth/complete-password-change", { method: "POST" })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(
        body?.error ??
          "Password aggiornata, ma non e' stato possibile completare l'attivazione dell'account. Contatta un amministratore.",
      )
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EEF1F9]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1E3A5F] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#2E8B72" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Imposta una nuova password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Per motivi di sicurezza devi sostituire la password temporanea prima di continuare.
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-0" />
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nuova password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Conferma password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
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
                className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Imposta password e continua"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
