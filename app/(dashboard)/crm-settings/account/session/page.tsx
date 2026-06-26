"use client"

import { useState } from "react"
import { Monitor, Smartphone, MapPin } from "lucide-react"
import {
  activeSessions,
  blockedIps,
  SESSION_TIMEOUTS,
  MAX_LOGIN_ATTEMPTS,
  type ActiveSession,
  type BlockedIp,
} from "@/lib/account-security-data"
import {
  SectionHeader,
  InitialsAvatar,
} from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function SessionAccessPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>(activeSessions)
  const [ips, setIps] = useState<BlockedIp[]>(blockedIps)
  const [timeout, setTimeoutVal] = useState("2 ore")
  const [maxAttempts, setMaxAttempts] = useState("5")
  const [twoFa, setTwoFa] = useState(false)
  const [ipBlock, setIpBlock] = useState(true)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Session & Access"
        description="Gestisci le sessioni attive, configura la sicurezza degli accessi e abilita l'autenticazione a due fattori."
      />

      {/* Sezione 1 — Sessioni attive */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Sessioni attive</h3>
              <Badge className="bg-teal/15 text-teal">{sessions.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Utenti attualmente connessi al CRM
            </p>
          </div>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setSessions([])}
            disabled={sessions.length === 0}
          >
            Termina tutte le sessioni
          </Button>
        </div>

        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Dispositivo / Browser</TableHead>
                <TableHead>Posizione</TableHead>
                <TableHead>Inizio sessione</TableHead>
                <TableHead>Ultima attività</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => {
                const isMobile = /iphone|android|mobile/i.test(s.os)
                const DeviceIcon = isMobile ? Smartphone : Monitor
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar iniziali={s.iniziali} />
                        <span className="font-medium text-foreground">{s.utente}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DeviceIcon className="size-4" />
                        <span>
                          {s.browser} · {s.os}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {s.posizione}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.inizio}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.ultima}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setSessions((prev) => prev.filter((x) => x.id !== s.id))}
                      >
                        Termina sessione
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nessuna sessione attiva.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Sezione 2 — Configurazione sicurezza */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground">Configurazione sicurezza</h3>

        {/* Timeout sessione */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">Timeout sessione</span>
            <span className="text-sm text-muted-foreground">
              Disconnetti automaticamente dopo un periodo di inattività
            </span>
          </div>
          <Select value={timeout} onValueChange={(v) => setTimeoutVal(v ?? "2 ore")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_TIMEOUTS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2FA */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Autenticazione a due fattori (2FA)
              </span>
              <Badge className="bg-teal/15 text-teal">Consigliato</Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              Richiedi il codice 2FA al login per tutti gli utenti Admin
            </span>
          </div>
          <Switch checked={twoFa} onCheckedChange={(v) => setTwoFa(v === true)} />
        </div>

        {/* Tentativi login massimi */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Tentativi di login massimi
            </span>
            <span className="text-sm text-muted-foreground">
              Numero di tentativi prima del blocco temporaneo
            </span>
          </div>
          <Select value={maxAttempts} onValueChange={(v) => setMaxAttempts(v ?? "5")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v) => `${v} tentativi`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MAX_LOGIN_ATTEMPTS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t} tentativi
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Blocco IP */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Blocco IP dopo login falliti
            </span>
            <span className="text-sm text-muted-foreground">
              Blocca automaticamente gli IP con più tentativi falliti in 10 minuti
            </span>
          </div>
          <Switch checked={ipBlock} onCheckedChange={(v) => setIpBlock(v === true)} />
        </div>

        <div className="pt-1">
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
            Salva impostazioni di sicurezza
          </Button>
        </div>
      </section>

      {/* Sezione 3 — IP bloccati */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">IP bloccati</h3>
          <Badge variant="outline" className="text-muted-foreground">
            {ips.length}
          </Badge>
        </div>

        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Bloccato il</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono text-xs text-foreground">{ip.ip}</TableCell>
                  <TableCell className="text-muted-foreground">{ip.motivo}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {ip.bloccato}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIps((prev) => prev.filter((x) => x.id !== ip.id))}
                    >
                      Sblocca
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nessun IP bloccato.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
