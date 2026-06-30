import {
  AlertCircle,
  CheckCircle2,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react"
import type { CurrentAccountProfile } from "@/lib/crm-settings/current-account"
import { InitialsAvatar } from "@/components/impostazioni/settings-ui"
import { Badge } from "@/components/ui/badge"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function AccountProfileCard({
  profile,
}: {
  profile: CurrentAccountProfile | null
}) {
  if (!profile) {
    return (
      <section className="flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="size-5 shrink-0" />
        <div>
          <p className="font-medium">Profilo sessione non disponibile</p>
          <p className="text-xs opacity-80">
            La sessione autenticata non è stata risolta. Ricarica o accedi nuovamente.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <InitialsAvatar
          iniziali={initials(profile.nome)}
          className="size-11 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {profile.nome}
            </p>
            <Badge className="gap-1 bg-navy text-navy-foreground">
              <ShieldCheck className="size-3" />
              {profile.ruoloNome}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {profile.email}
            </span>
            {profile.sede ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {profile.sede}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 text-teal" />
        {profile.attivo ? "Account attivo" : "Account sospeso"}
      </div>
    </section>
  )
}
