"use client"

import { useCallback, useEffect, useState } from "react"
import type { SystemSettingKey } from "./system-store"

type Setter<T> = T | ((previous: T) => T)

export function usePersistentSystemSetting<T>(
  key: SystemSettingKey,
  initialValue: T,
) {
  const [value, setValueState] = useState<T>(initialValue)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/crm-settings/system/${key}`, {
          cache: "no-store",
        })
        const body = (await res.json().catch(() => null)) as {
          value?: T | null
          error?: string
        } | null

        if (!res.ok) throw new Error(body?.error ?? "Caricamento configurazione non riuscito")
        if (!cancelled && body?.value !== null && body?.value !== undefined) {
          setValueState(body.value)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Caricamento configurazione non riuscito")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [key])

  const persist = useCallback(
    async (nextValue: T) => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(`/api/crm-settings/system/${key}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: nextValue }),
        })
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) throw new Error(body?.error ?? "Salvataggio configurazione non riuscito")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Salvataggio configurazione non riuscito")
      } finally {
        setSaving(false)
      }
    },
    [key],
  )

  const setValue = useCallback(
    (next: Setter<T>) => {
      setValueState((previous) => {
        const resolved =
          typeof next === "function" ? (next as (previous: T) => T)(previous) : next
        void persist(resolved)
        return resolved
      })
    },
    [persist],
  )

  return [value, setValue, { loading, saving, error }] as const
}
