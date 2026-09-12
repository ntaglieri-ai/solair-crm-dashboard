"use client"

import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AiAllegatiButton({
  className,
  size,
}: {
  className?: string
  size?: "sm" | "default"
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled
      aria-label="Compila scheda da allegati"
      title="Funzione in preparazione"
      className={cn("bg-card text-[#6f42c1] shadow-sm", className)}
    >
      <Sparkles data-icon="inline-start" />
      Compila da allegati
    </Button>
  )
}
