"use client"

import { useState } from "react"
import { Loader2, Mail, MessageCircle, Phone } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MittenteSelect, useMittenti } from "@/components/shared/mittente-select"
import { cn } from "@/lib/utils"

// Icone di contatto rapido (telefono/email/WhatsApp) accanto al nome, per
// Lead e Cliente. Il telefono e' un <a href="tel:"> vero, presente nel DOM
// senza aspettare il click: e' l'unica forma che le estensioni click-to-call
// del browser (3CX Click2Call) sanno intercettare. Con la vecchia navigazione
// via JS (window.location.href nell'onClick) l'estensione non vedeva nessun
// link e la chiamata finiva all'app di sistema — FaceTime su macOS — invece
// che al centralino. WhatsApp resta un fallback wa.me finche' Spoki non e'
// collegato.
// L'email invece e' gia' reale: riusa la stessa infrastruttura di invio
// costruita per "Invia email ai lead filtrati" (casella Aruba personale
// dell'agente), qui applicata a un solo destinatario.

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "")
}

/**
 * Numero normalizzato per un `href="tel:"`: tiene il "+" del prefisso
 * internazionale e toglie tutto il resto che non sia una cifra (spazi,
 * trattini, parentesi, punti, barre).
 *
 * Volutamente separata da digitsOnly() e non costruita sopra di essa: quella
 * serve a wa.me, che vuole solo cifre e rifiuta il "+", ed e' usata anche
 * altrove. Qui il "+" invece va conservato — un numero in formato
 * internazionale che arriva al centralino senza prefisso viene letto come
 * nazionale e la chiamata parte verso il numero sbagliato. Le due funzioni
 * hanno requisiti opposti: non vanno unificate.
 */
export function telHref(value: string) {
  // Il "+" si cerca come primo carattere SIGNIFICATIVO, saltando spazi e
  // parentesi di apertura: in anagrafica il prefisso capita scritto
  // "(+39) 347 …", e guardare solo il primo carattere lo perderebbe insieme
  // alla parentesi, degradando il numero a nazionale.
  const prefisso = /^[\s(]*\+/.test(value) ? "+" : ""
  return prefisso + value.replace(/[^\d]/g, "")
}

export function QuickContactIcons({
  kind,
  recordId,
  nome,
  telefono,
  email,
  show = ["phone", "whatsapp", "email"],
  emailAsButton = false,
}: {
  kind: "lead" | "cliente"
  recordId: string
  nome: string
  telefono?: string | null
  email?: string | null
  /** Quali icone mostrare: sul nome tutte e tre, su Telefono/E-mail solo la propria. */
  show?: Array<"phone" | "whatsapp" | "email">
  /** Se true, l'azione email si presenta come pulsante con etichetta "Invia e-mail"
   * (per gli header di dettaglio) invece che come icona compatta (per le celle tabella). */
  emailAsButton?: boolean
}) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  // Caselle disponibili caricate all'apertura del dialog, non al mount: la
  // riga di icone compare in ogni cella della tabella.
  const mittenti = useMittenti(emailOpen)

  const phoneDigits = digitsOnly(telefono ?? "")
  const hasPhone = phoneDigits.length > 0
  const hasEmail = Boolean(email && email.includes("@"))

  async function sendSingleEmail() {
    setSending(true)
    try {
      const endpoint =
        kind === "lead" ? "/api/leads/send-email" : "/api/clienti/send-email"
      const idsKey = kind === "lead" ? "leadIds" : "clienteIds"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [idsKey]: [recordId],
          subject,
          body,
          mittenteId: mittenti.selectedId,
        }),
      })
      const result = (await res.json().catch(() => null)) as {
        error?: string
        sent?: number
      } | null
      if (!res.ok) {
        toast.error(result?.error ?? "Invio non riuscito")
        return
      }
      toast.success(`Email inviata a ${nome}`)
      setEmailOpen(false)
      setSubject("")
      setBody("")
    } catch {
      toast.error("Invio non riuscito: errore di rete")
    } finally {
      setSending(false)
    }
  }

  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      onClick={(event) => event.stopPropagation()}
    >
      {show.includes("phone") &&
        (hasPhone ? (
          <a
            href={`tel:${telHref(telefono ?? "")}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-6 text-muted-foreground hover:text-foreground",
            )}
            title={`Chiama ${telefono}`}
            aria-label={`Chiama ${telefono}`}
          >
            <Phone className="size-3.5" />
          </a>
        ) : (
          // Senza numero resta un <button> nativo: è l'unico elemento su cui
          // `disabled:` di Tailwind fa presa, e un link senza href non si
          // disabilita.
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-25"
            disabled
            title="Nessun numero disponibile"
          >
            <Phone className="size-3.5" />
          </Button>
        ))}
      {show.includes("email") &&
        (emailAsButton ? (
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!hasEmail}
            title={hasEmail ? `Scrivi a ${email}` : "Nessuna email disponibile"}
            onClick={() => hasEmail && setEmailOpen(true)}
          >
            <Mail data-icon="inline-start" />
            Invia e-mail
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-25"
            disabled={!hasEmail}
            title={hasEmail ? `Scrivi a ${email}` : "Nessuna email disponibile"}
            onClick={() => hasEmail && setEmailOpen(true)}
          >
            <Mail className="size-3.5" />
          </Button>
        ))}
      {show.includes("whatsapp") && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-25"
          disabled={!hasPhone}
          title={hasPhone ? "Apri WhatsApp" : "Nessun numero disponibile"}
          onClick={() => {
            if (hasPhone) {
              window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer")
            }
          }}
        >
          <MessageCircle className="size-3.5" />
        </Button>
      )}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent
          className="sm:max-w-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Scrivi a {nome}</DialogTitle>
            <DialogDescription>{email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <MittenteSelect state={mittenti} disabled={sending} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`quick-subject-${recordId}`}>Oggetto</Label>
              <Input
                id={`quick-subject-${recordId}`}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Oggetto dell'email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`quick-body-${recordId}`}>Messaggio</Label>
              <Textarea
                id={`quick-body-${recordId}`}
                rows={5}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Scrivi il messaggio…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Annulla
            </Button>
            <Button disabled={!subject.trim() || sending} onClick={sendSingleEmail}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              ) : (
                <Mail className="size-4" data-icon="inline-start" />
              )}
              {sending ? "Invio..." : "Invia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  )
}
