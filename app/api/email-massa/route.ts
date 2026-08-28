import { NextResponse, after } from "next/server"
import { getCurrentPermissions, requireApiRecord } from "@/lib/permissions/server"
import { getPersonalEmailPassword, getPersonalEmailStatus } from "@/lib/email/personal-credentials"
import { getCommunicationEmailPolicy } from "@/lib/email/communication-policy"
import { sendBulkEmails } from "@/lib/email/bulk-mailer"
import { resolveSender } from "@/lib/email/sender-accounts"
import { logEmailInviate } from "@/lib/email/email-log"
import { hasSystemOutboundSmtp } from "@/lib/email/lead-mailer"
import { MAX_BULK_RECIPIENTS } from "@/lib/email/bulk-template"
import {
  bulkTargetConfig,
  isBulkRecordTipo,
  resolveBulkRecipients,
} from "@/lib/email/bulk-targets"
import {
  createEmailMassaJob,
  finishEmailMassaJob,
  updateEmailMassaProgress,
} from "@/lib/email/bulk-job-store"

// Endpoint UNICO di invio di massa per Lead / Clienti / Installatori: la
// differenza tra i tre moduli e' tutta dichiarativa in lib/email/bulk-targets.
//
// La risposta NON attende l'invio: il ritmo viene deciso dalla policy
// Comunicazioni (SES piu' rapido, fallback Aruba prudente). Si accoda un
// job, si risponde con il suo id, e l'invio prosegue in background via
// after() aggiornando email_massa_jobs — stesso pattern gia' usato per il
// provisioning Nextcloud.

// Il lavoro dentro after() NON e' gratis in termini di durata: la funzione
// resta viva finche' il task non finisce, ed e' comunque tagliata da
// maxDuration. Il fallback Aruba resta volutamente lento, quindi qui si alza
// il tetto.
// NOTA: 300s e' consentito su piano Pro; su Hobby il massimo e' 60 e questo
// valore va abbassato, altrimenti il deploy fallisce.
export const maxDuration = 300

/** Scrittura del progresso su DB al massimo ogni 2s, per non moltiplicare le
 *  update: la UI polla comunque ogni 2.5s. */
const PROGRESS_FLUSH_MS = 2000

type Payload = {
  recordTipo?: unknown
  recordIds?: unknown
  oggetto?: unknown
  template?: unknown
  /** Casella scelta nel dropdown "Invia da": una sola per tutto il batch. */
  mittenteId?: unknown
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Payload | null

  const recordTipo = payload?.recordTipo
  if (!isBulkRecordTipo(recordTipo)) {
    return NextResponse.json({ error: "Tipo record non valido." }, { status: 400 })
  }

  const config = bulkTargetConfig(recordTipo)
  const guard = await requireApiRecord(config.permissionModule, "view")
  if (guard.response) return guard.response

  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const recordIds = Array.isArray(payload?.recordIds)
    ? payload.recordIds.filter((id): id is string => typeof id === "string")
    : []
  const oggetto = typeof payload?.oggetto === "string" ? payload.oggetto.trim() : ""
  const template = typeof payload?.template === "string" ? payload.template : ""
  const mittenteId = typeof payload?.mittenteId === "string" ? payload.mittenteId : null

  if (recordIds.length === 0) {
    return NextResponse.json({ error: "Nessun record selezionato." }, { status: 400 })
  }
  if (!oggetto) {
    return NextResponse.json({ error: "L'oggetto e' obbligatorio." }, { status: 400 })
  }
  if (!template.trim()) {
    return NextResponse.json({ error: "Il messaggio e' obbligatorio." }, { status: 400 })
  }
  // Tetto verificato anche qui e non solo in UI: il bottone disabilitato lato
  // client non e' una garanzia.
  if (new Set(recordIds).size > MAX_BULK_RECIPIENTS) {
    return NextResponse.json(
      {
        error: `Massimo ${MAX_BULK_RECIPIENTS} destinatari per invio di massa. Riduci la selezione.`,
      },
      { status: 400 },
    )
  }

  // Destinatari risolti PRIMA della casella dell'agente: se non c'e' nessuno
  // a cui si possa scrivere, chiedere di configurare la casella manderebbe
  // l'agente a risolvere il problema sbagliato.
  const { data: resolved, error: resolveError } = await resolveBulkRecipients({
    tipo: recordTipo,
    recordIds,
    snapshot: permissions.snapshot,
  })
  if (resolveError || !resolved) {
    return NextResponse.json({ error: resolveError ?? "Errore imprevisto" }, { status: 500 })
  }

  if (resolved.recipients.length === 0) {
    return NextResponse.json(
      {
        error: `Nessuno dei ${config.label.plurale} selezionati e' inviabile: nessun destinatario con email valida di tua competenza.`,
        esclusiNonProprietari: resolved.esclusiNonProprietari,
        esclusiSenzaEmail: resolved.esclusiSenzaEmail,
        esclusiSenzaConsenso: resolved.esclusiSenzaConsenso,
      },
      { status: 400 },
    )
  }

  const emailPolicy = await getCommunicationEmailPolicy()
  const systemSmtpAvailable = hasSystemOutboundSmtp(emailPolicy)

  // La casella personale e' obbligatoria solo quando l'SMTP di sistema manca e
  // resta il fallback Aruba, l'unico percorso che si autentica su quella
  // casella. Prima la si esigeva anche con bulkReplyTo = "agente", che e' il
  // default: ma il Reply-To e' un indirizzo, non una credenziale, e utenti.email
  // lo soddisfa senza chiedere nulla nel Profilo.
  const emailStatus = await getPersonalEmailStatus(subject.userId)
  const smtpPassword = emailStatus.configured
    ? ((await getPersonalEmailPassword(subject.userId)) ?? undefined)
    : undefined

  if (!systemSmtpAvailable && (!emailStatus.smtpUser || !smtpPassword)) {
    return NextResponse.json(
      {
        error:
          "Configura prima la tua casella email personale nel tuo Profilo per poter inviare email di massa.",
        needsEmailSetup: true,
      },
      { status: 400 },
    )
  }

  // Mittente validato PRIMA di accodare il job: un rifiuto dopo la creazione
  // lascerebbe una riga email_massa_jobs in "in_corso" che nessuno chiude.
  const mittente = await resolveSender({ utenteId: subject.userId, accountId: mittenteId })
  if (!mittente.ok) {
    return NextResponse.json({ error: mittente.error }, { status: 403 })
  }

  const { job, error: jobError } = await createEmailMassaJob({
    recordTipo,
    oggetto,
    totale: resolved.recipients.length,
    creatoDa: subject.userId,
  })
  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError ?? "Impossibile accodare l'invio." },
      { status: 500 },
    )
  }

  const recipients = resolved.recipients
  const smtpUser = emailStatus.smtpUser || subject.email || undefined

  after(async () => {
    let lastFlush = 0
    try {
      const outcome = await sendBulkEmails({
        smtpUser,
        smtpPassword,
        fromEmail: mittente.sender.fromEmail,
        fromName: mittente.sender.fromName,
        subject: oggetto,
        template,
        recipients,
        consentEntita: config.consentEntita,
        onProgress: async (progress) => {
          const now = Date.now()
          if (now - lastFlush < PROGRESS_FLUSH_MS) return
          lastFlush = now
          await updateEmailMassaProgress(job.id, progress)
        },
      })
      // Storico invii: gli installatori non hanno una scheda con storico e
      // config.consentEntita e' gia' il discriminante giusto (null solo per
      // loro), quindi si registra solo lead e clienti.
      if (config.consentEntita) {
        await logEmailInviate({
          entita: config.consentEntita,
          destinatari: outcome.destinatariRaggiunti,
          fromEmail: outcome.fromEmail,
          fromNome: outcome.fromName,
          oggetto,
          inviataDa: subject.userId,
        })
      }

      await finishEmailMassaJob(job.id, {
        inviate: outcome.inviate,
        fallite: outcome.fallite,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore imprevisto"
      console.error(`[email-massa] job ${job.id} interrotto:`, message)
      // Contatori non toccati: restano all'ultimo flush noto, che e' il
      // numero minimo garantito di email gia' partite.
      await finishEmailMassaJob(job.id, { errore: message })
    }
  })

  return NextResponse.json(
    {
      jobId: job.id,
      totale: resolved.recipients.length,
      totaleRichiesti: resolved.totaleRichiesti,
      esclusiNonProprietari: resolved.esclusiNonProprietari,
      esclusiSenzaEmail: resolved.esclusiSenzaEmail,
      esclusiSenzaConsenso: resolved.esclusiSenzaConsenso,
      consensoEnforcementAttivo: resolved.consensoEnforcementAttivo,
      inviatiSenzaConsenso: 0,
    },
    { status: 202 },
  )
}
