// app/cambia-password/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"

const MIN_LENGTH = 8

export default function CambiaPasswordPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

    const res = await fetch("/api/auth/complete-password-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(
        body?.error ??
          "Password aggiornata, ma non e' stato possibile completare l'attivazione dell'account. Contatta un amministratore.",
      )
      setLoading(false)
      return
    }

    const body = (await res.json().catch(() => null)) as { ok: true; email?: string } | null

    // L'update password lato admin (necessario per impostarla server-side)
    // revoca il refresh token della sessione corrente, anche se e' l'utente
    // stesso a cambiarla: il token in mano al browser resta leggibile
    // localmente ancora per un po', ma non e' piu' valido lato server. Senza
    // un login fresco qui, la sessione risulterebbe invalida al primo utilizzo
    // reale (es. l'handshake OIDC di "Apri Nextcloud"), anche se la
    // navigazione nel CRM sembra funzionare normalmente nel frattempo.
    if (body?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: body.email,
        password,
      })
      if (signInError) {
        setError(
          "Password aggiornata, ma il nuovo accesso non e' riuscito. Prova a fare login manualmente.",
        )
        setLoading(false)
        return
      }
    }

    router.push("/")
    router.refresh()
  }

  return (
    <AuthShell
      eyebrow="Ultimo passo"
      title="Imposta una nuova password"
      subtitle="Per motivi di sicurezza devi sostituire la password temporanea prima di continuare."
    >
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
          className="w-full bg-[#1E3A5F] transition-all hover:brightness-110"
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
    </AuthShell>
  )
}
