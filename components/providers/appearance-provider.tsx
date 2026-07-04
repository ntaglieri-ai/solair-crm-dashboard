"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type AppearancePreferences,
} from "@/lib/crm-settings/appearance"

const STORAGE_KEY = "solair:appearance"

type AppearanceContextValue = {
  preferences: AppearancePreferences
  loading: boolean
  saving: boolean
  updatePreferences: (value: AppearancePreferences) => Promise<boolean>
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function cachedAppearance() {
  try {
    return normalizeAppearance(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"),
    )
  } catch {
    return DEFAULT_APPEARANCE
  }
}

function applyAppearance(preferences: AppearancePreferences) {
  const root = document.documentElement
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const dark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" && prefersDark)

  root.classList.toggle("dark", dark)
  root.classList.toggle("light", !dark)
  root.dataset.accent = preferences.accent
  root.dataset.density = preferences.density
  root.dataset.radius = preferences.radius
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<AppearancePreferences>(DEFAULT_APPEARANCE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const cached = cachedAppearance()
    queueMicrotask(() => setPreferences(cached))
    applyAppearance(cached)

    let active = true
    fetch("/api/crm-settings/appearance", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active || !payload?.value) return
        const next = normalizeAppearance(payload.value)
        setPreferences(next)
        applyAppearance(next)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (preferences.theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => applyAppearance(preferences)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [preferences])

  const updatePreferences = useCallback(
    async (next: AppearancePreferences) => {
      const normalized = normalizeAppearance(next)
      const previous = preferences
      setPreferences(normalized)
      applyAppearance(normalized)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
      setSaving(true)
      try {
        const response = await fetch("/api/crm-settings/appearance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: normalized }),
        })
        if (!response.ok) throw new Error("Salvataggio non riuscito")
        return true
      } catch {
        setPreferences(previous)
        applyAppearance(previous)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(previous))
        return false
      } finally {
        setSaving(false)
      }
    },
    [preferences],
  )

  const value = useMemo(
    () => ({ preferences, loading, saving, updatePreferences }),
    [preferences, loading, saving, updatePreferences],
  )

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) {
    throw new Error("useAppearance must be used within AppearanceProvider")
  }
  return value
}
