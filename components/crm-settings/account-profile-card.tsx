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
import { cn } from "@/lib/utils"

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
    <section className="relative overflow-hidden rounded-xl border border-white/80 bg-white px-4 py-3 shadow-[0_14px_34px_rgb(30_58_95/8%)] ring-1 ring-slate-900/[0.03]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#0176d3,#2e8b72)]" aria-hidden />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <InitialsAvatar
          iniziali={initials(profile.nome)}
          className="size-11 shrink-0 bg-gradient-to-br from-[#173e6b] to-[#0176d3] shadow-[0_10px_22px_rgb(1_118_211/22%)]"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {profile.nome}
            </p>
            <Badge className="gap-1 bg-[#173e6b] text-white shadow-sm">
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
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
          profile.attivo
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-100 text-slate-600",
        )}
      >
        <CheckCircle2 className={cn("size-4", profile.attivo ? "text-emerald-600" : "text-slate-500")} />
        {profile.attivo ? "Account attivo" : "Account sospeso"}
      </div>
      </div>
    </section>
  )
}
