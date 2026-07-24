"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Camera, CheckCircle2, LockKeyhole, Mail, Palette, Save, SendHorizonal, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PersonalProfileData, PersonalProfilePreferences } from "@/lib/profile/personal-profile"

const AVATAR_COLORS = ["#1e3a5f", "#247b67", "#315fc5", "#8b6bd6", "#ef6a47", "#b8273d"]

function initials(nome: string, cognome: string) {
  return [nome, cognome]
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??"
}

function formatDate(value: string | null) {
  if (!value) return "Non disponibile"
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

export function ProfileForm({ initialProfile }: { initialProfile: PersonalProfileData }) {
  const [nome, setNome] = useState(initialProfile.nome)
  const [cognome, setCognome] = useState(initialProfile.cognome)
  const [preferences, setPreferences] = useState<PersonalProfilePreferences>(
    initialProfile.preferences,
  )
  const [saving, setSaving] = useState(false)

  // Casella email personale (mittente reale nelle email verso i lead — vedi
  // il pulsante "Invia email" su Lead). Separata dall'email di accesso al
  // CRM: puo' coincidere o no, nessun vincolo.
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null)
  const [savedSmtpUser, setSavedSmtpUser] = useState<string | null>(null)
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [savingEmail, setSavingEmail] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/profilo/email-credentials", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { configured?: boolean; smtpUser?: string | null }) => {
        if (cancelled) return
        setEmailConfigured(Boolean(data.configured))
        setSavedSmtpUser(data.smtpUser ?? null)
        if (data.smtpUser) setSmtpUser(data.smtpUser)
      })
      .catch(() => {
        if (!cancelled) setEmailConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveEmailCredentials() {
    setSavingEmail(true)
    try {
      const response = await fetch("/api/profilo/email-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpUser, smtpPassword }),
      })
      const result = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error ?? "Salvataggio non riuscito")
      toast.success("Casella email personale salvata")
      setEmailConfigured(true)
      setSavedSmtpUser(smtpUser)
      setSmtpPassword("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito")
    } finally {
      setSavingEmail(false)
    }
  }

  const currentInitials = useMemo(() => initials(nome, cognome), [nome, cognome])
  const avatarPreview =
    preferences.avatarMode === "photo" && preferences.avatarUrl.trim() ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={preferences.avatarUrl}
        alt=""
        className="size-full rounded-full object-cover"
      />
    ) : (
      currentInitials
    )

  function setPreference<K extends keyof PersonalProfilePreferences>(
    key: K,
    value: PersonalProfilePreferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  function loadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un'immagine valida")
      return
    }
    if (file.size > 400_000) {
      toast.error("Usa un'immagine sotto 400 KB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      setPreferences((current) => ({
        ...current,
        avatarMode: "photo",
        avatarUrl: reader.result as string,
      }))
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch("/api/profilo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          cognome,
          preferences,
        }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? "Salvataggio non riuscito")
      toast.success("Profilo aggiornato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
      <section className="profile-panel">
        <div className="profile-hero">
          <div
            className="profile-avatar-preview"
            style={{ "--profile-avatar": preferences.avatarColor } as React.CSSProperties}
          >
            {avatarPreview}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-white/75">Profilo personale</p>
            <h1 className="mt-1 truncate text-4xl font-black text-white">
              {[nome, cognome].filter(Boolean).join(" ") || initialProfile.fullName}
            </h1>
            <p className="mt-2 text-base font-semibold text-white/80">
              {initialProfile.ruoloNome}
              {initialProfile.sede ? ` · ${initialProfile.sede}` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-nome">Nome</Label>
              <Input
                id="profile-nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-cognome">Cognome</Label>
              <Input
                id="profile-cognome"
                value={cognome}
                onChange={(event) => setCognome(event.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email di accesso</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  value={initialProfile.email}
                  readOnly
                  className="bg-muted/60 pl-9"
                />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Per modificare l&apos;email di accesso contatta un amministratore.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Telefono</Label>
              <Input
                id="profile-phone"
                value={preferences.telefono}
                onChange={(event) => setPreference("telefono", event.target.value)}
                placeholder="+39 ..."
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-role">Ruolo</Label>
              <Input id="profile-role" value={initialProfile.ruoloNome} readOnly className="bg-muted/60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-site">Sede</Label>
              <Input
                id="profile-site"
                value={initialProfile.sede ?? "Non assegnata"}
                readOnly
                className="bg-muted/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-title">Mansione / titolo interno</Label>
            <Input
              id="profile-title"
              value={preferences.mansione}
              onChange={(event) => setPreference("mansione", event.target.value)}
              placeholder="Es. Sales Manager, Back office, Tecnico..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-bio">Nota personale</Label>
            <Textarea
              id="profile-bio"
              value={preferences.bio}
              onChange={(event) => setPreference("bio", event.target.value)}
              placeholder="Una breve nota visibile nel tuo profilo personale."
              className="min-h-28"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div className="text-sm text-muted-foreground">
              Account creato il <strong className="text-foreground">{formatDate(initialProfile.createdAt)}</strong>
            </div>
            <Button onClick={save} disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? "Salvataggio..." : "Salva profilo"}
            </Button>
          </div>
        </div>
      </section>

      <aside className="grid content-start gap-5">
        <section className="profile-side-card">
          <div className="flex items-center gap-2 text-sm font-black text-[#315fc5]">
            <Camera className="size-5" />
            Avatar
          </div>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1">
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-bold ${preferences.avatarMode === "initials" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setPreference("avatarMode", "initials")}
              >
                Iniziali
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-bold ${preferences.avatarMode === "photo" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setPreference("avatarMode", "photo")}
              >
                Foto
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-avatar-file">Carica foto profilo</Label>
              <Input
                id="profile-avatar-file"
                type="file"
                accept="image/*"
                onChange={loadPhoto}
              />
              <p className="text-xs text-muted-foreground">
                Immagine piccola, massimo 400 KB. In alternativa puoi usare un URL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-avatar-url">URL foto</Label>
              <Input
                id="profile-avatar-url"
                value={preferences.avatarUrl}
                onChange={(event) => setPreference("avatarUrl", event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <Palette className="size-4" />
                Colore avatar
              </div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Colore avatar ${color}`}
                    className={`size-9 rounded-full border-2 ${preferences.avatarColor === color ? "border-foreground" : "border-white"} shadow-sm`}
                    style={{ background: color }}
                    onClick={() => setPreference("avatarColor", color)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className={`profile-side-card ${emailConfigured === false ? "ring-2 ring-amber-400" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm font-black text-[#ef6a47]">
            <SendHorizonal className="size-5" />
            Email per contatto lead
          </div>
          <div className="mt-4 grid gap-3">
            {emailConfigured === false && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Configura la tua casella per poter scrivere ai lead a nome tuo (indipendente
                  dall&apos;email di accesso al CRM).
                </span>
              </div>
            )}
            {emailConfigured === true && savedSmtpUser && (
              <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>
                  Configurata: <strong>{savedSmtpUser}</strong>
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="lead-smtp-user">Indirizzo email (es. nome.cognome@solairgroup.it)</Label>
              <Input
                id="lead-smtp-user"
                type="email"
                value={smtpUser}
                onChange={(event) => setSmtpUser(event.target.value)}
                placeholder="nome.cognome@solairgroup.it"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-smtp-password">Password casella</Label>
              <Input
                id="lead-smtp-password"
                type="password"
                value={smtpPassword}
                onChange={(event) => setSmtpPassword(event.target.value)}
                placeholder={emailConfigured ? "••••••••" : "Password"}
              />
            </div>
            <Button
              variant="outline"
              onClick={saveEmailCredentials}
              disabled={savingEmail || !smtpUser.trim() || !smtpPassword}
            >
              <Save data-icon="inline-start" />
              {savingEmail ? "Salvataggio..." : "Salva casella email"}
            </Button>
          </div>
        </section>

        <section className="profile-side-card">
          <div className="flex items-center gap-2 text-sm font-black text-[#20a47a]">
            <ShieldCheck className="size-5" />
            Sicurezza
          </div>
          <div className="mt-4 grid gap-3">
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>Email e ruolo sono protetti dalle impostazioni account.</span>
            </div>
            <Button variant="outline" nativeButton={false} render={<Link href="/cambia-password" />}>
              <LockKeyhole data-icon="inline-start" />
              Cambia password
            </Button>
          </div>
        </section>
      </aside>
    </div>
  )
}
