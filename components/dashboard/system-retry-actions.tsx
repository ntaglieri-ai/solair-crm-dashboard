"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function SystemRetryButton({
  userId,
  kind,
}: {
  userId: string
  kind: "nextcloud" | "welcome-email"
}) {
  const [loading, setLoading] = useState(false)
  const label = kind === "nextcloud" ? "Riprova Nextcloud" : "Rinvia email"

  async function retry() {
    setLoading(true)
    try {
      const response = await fetch(`/api/crm-settings/utenti/${userId}/${kind}`, {
        method: "POST",
      })
      if (!response.ok) throw new Error()
      toast.success("Azione rilanciata")
    } catch {
      toast.error("Riprova non riuscita")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={retry} disabled={loading}>
      <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : ""} />
      {loading ? "In corso" : label}
    </Button>
  )
}
