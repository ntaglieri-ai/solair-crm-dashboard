import {
  Mail,
  Phone,
  MapPin,
  Building2,
  UserCircle,
  Megaphone,
  CalendarDays,
  Flame,
  Eye,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { type Lead } from "@/lib/mock-data"
import { LeadAvatar } from "./lead-utils"
import { LeadMiniMap } from "./lead-mini-map"

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="truncate text-sm font-medium text-foreground">
          {value && value !== "" ? value : "—"}
        </span>
      </div>
    </div>
  )
}

export function LeadDetailSidebar({ lead }: { lead: Lead }) {
  const nome = lead["Nome Lead"]
  const indirizzoCompleto = [
    [lead["Codice postale"], lead["Città"]].filter(Boolean).join(" "),
    lead.Provincia,
    lead.Paese,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="flex flex-col gap-4">
      {/* Riepilogo */}
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <LeadAvatar nome={nome} className="size-12 text-sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-semibold text-foreground">
                {nome}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {lead["Città"]} ({lead.Provincia})
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <InfoRow icon={Mail} label="E-mail" value={lead["E-mail"]} />
            <InfoRow icon={Phone} label="Telefono" value={lead.Telefono} />
            <InfoRow icon={MapPin} label="Indirizzo" value={indirizzoCompleto} />
            <InfoRow icon={Building2} label="Sede" value={lead.Sede} />
            <InfoRow
              icon={UserCircle}
              label="Lead Proprietario"
              value={lead["Lead Proprietario"]}
            />
            <InfoRow icon={Megaphone} label="Origine Lead" value={lead["Origine Lead"]} />
            <InfoRow
              icon={CalendarDays}
              label="Ora creazione"
              value={lead["Ora creazione"]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-[18px] text-info" />
            Email tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stato email</span>
            <span className="text-sm font-medium text-foreground">
              {lead.Stato}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Aperture email</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {lead.emailAperture}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ultima attività</span>
            <span className="text-sm font-medium text-foreground">
              {lead["Ora ultima attività"]}
            </span>
          </div>
          {lead.leadCaldo ? (
            <Badge className="w-fit gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <Flame className="size-3.5" />
              Lead caldo · aperta nelle ultime 24h
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {/* Posizione */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-[18px] text-teal" />
            Posizione
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeadMiniMap lead={lead} />
        </CardContent>
      </Card>
    </div>
  )
}
