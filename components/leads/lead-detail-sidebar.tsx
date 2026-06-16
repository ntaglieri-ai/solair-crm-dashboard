"use client"

import { useState } from "react"
import { toast } from "sonner"
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
  IconPhone,
  IconMail,
  IconSend,
  IconX,
} from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type Lead } from "@/lib/mock-data"
import { LeadAvatar } from "./lead-utils"
import { LeadMiniMap } from "./lead-mini-map"
import { LeadTasksCard } from "./lead-tasks-card"

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

function PhoneRow({ telefono }: { telefono: string }) {
  const copy = () => {
    navigator.clipboard?.writeText(telefono)
    toast.success("Numero copiato!", { description: telefono, duration: 2000 })
  }
  return (
    <div className="group flex items-start gap-3">
      <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">Telefono</span>
        <span className="truncate text-sm font-medium text-foreground">
          {telefono || "—"}
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Chiama / copia numero"
              onClick={copy}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-navy opacity-0 transition-all duration-150 hover:bg-secondary hover:scale-110 group-hover:opacity-100"
            >
              <IconPhone size={16} stroke={1.8} />
            </button>
          }
        />
        <TooltipContent>Chiama</TooltipContent>
      </Tooltip>
    </div>
  )
}

function EmailRow({
  email,
  onCompose,
}: {
  email: string
  onCompose: () => void
}) {
  return (
    <div className="group flex items-start gap-3">
      <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">E-mail</span>
        <span className="truncate text-sm font-medium text-foreground">
          {email || "—"}
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Invia email"
              onClick={onCompose}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-navy opacity-0 transition-all duration-150 hover:bg-secondary hover:scale-110 group-hover:opacity-100"
            >
              <IconMail size={16} stroke={1.8} />
            </button>
          }
        />
        <TooltipContent>Invia email</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function LeadDetailSidebar({ lead }: { lead: Lead }) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [oggetto, setOggetto] = useState("")
  const [corpo, setCorpo] = useState("")
  const nome = lead["Nome Lead"]
  const indirizzoCompleto = [
    [lead["Codice postale"], lead["Città"]].filter(Boolean).join(" "),
    lead.Provincia,
    lead.Paese,
  ]
    .filter(Boolean)
    .join(", ")

  const sendEmail = () => {
    toast.success("Email inviata", {
      description: `Messaggio inviato a ${lead["E-mail"]}.`,
    })
    setOggetto("")
    setCorpo("")
    setComposeOpen(false)
  }

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
            <EmailRow
              email={lead["E-mail"]}
              onCompose={() => setComposeOpen((v) => !v)}
            />

            {/* Pannello compose email inline (slide-down) */}
            {composeOpen ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Nuova email
                  </span>
                  <button
                    type="button"
                    aria-label="Chiudi"
                    onClick={() => setComposeOpen(false)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <IconX size={15} stroke={1.8} />
                  </button>
                </div>
                <Input
                  value={oggetto}
                  onChange={(e) => setOggetto(e.target.value)}
                  placeholder="Oggetto"
                  className="h-8 bg-card text-sm"
                />
                <Textarea
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  rows={3}
                  placeholder="Scrivi il messaggio…"
                  className="bg-card text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="bg-teal text-teal-foreground hover:bg-teal/90"
                    onClick={sendEmail}
                  >
                    <IconSend size={15} stroke={1.8} data-icon="inline-start" />
                    Invia
                  </Button>
                </div>
              </div>
            ) : null}

            <PhoneRow telefono={lead.Telefono} />
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

      {/* Prossime attività */}
      <LeadTasksCard lead={lead} />

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
