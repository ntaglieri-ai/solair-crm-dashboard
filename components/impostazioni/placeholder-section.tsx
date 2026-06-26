import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

/**
 * Sezione segnaposto per le aree delle impostazioni ancora in lavorazione.
 * Mostra header + card vuota con icona e messaggio "In configurazione".
 */
export function PlaceholderSection({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={title} description={description} />
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
        <p className="text-sm font-medium text-foreground">In configurazione</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Questa sezione sarà disponibile a breve.
        </p>
      </Card>
    </div>
  )
}
