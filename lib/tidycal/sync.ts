import { createAdminClient } from "@/lib/supabase/admin"
import {
  listTidyCalBookings,
  listTidyCalBookingTypes,
  type TidyCalBooking,
} from "./client"

const DAY_MS = 24 * 60 * 60 * 1000

export interface TidyCalSyncResult {
  bookings: number
  imported: number
  linkedToLeads: number
  linkedToClients: number
  cancelled: number
  startsAt: string
  endsAt: string
}

function tidyCalDateTime(date: Date) {
  // L'OpenAPI descrive questi filtri come `date`, ma l'endpoint reale
  // valida il formato stretto Y-m-dTH:i:sZ (senza millisecondi).
  return date.toISOString().replace(/\.\d{3}Z$/, "Z")
}

function syncWindow(now = new Date()) {
  const pastDays = Number(process.env.TIDYCAL_SYNC_PAST_DAYS ?? 365)
  const futureDays = Number(process.env.TIDYCAL_SYNC_FUTURE_DAYS ?? 730)
  return {
    startsAt: tidyCalDateTime(new Date(now.getTime() - Math.max(0, pastDays) * DAY_MS)),
    endsAt: tidyCalDateTime(new Date(now.getTime() + Math.max(1, futureDays) * DAY_MS)),
  }
}

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function notesFor(booking: TidyCalBooking, bookingTypeTitle: string) {
  const rows = [
    `Prenotazione TidyCal: ${bookingTypeTitle}`,
    `Contatto: ${booking.contact.name} <${booking.contact.email}>`,
  ]
  if (booking.contact.phone_number) rows.push(`Telefono: ${booking.contact.phone_number}`)
  if (booking.meeting_url) rows.push(`Collegamento riunione: ${booking.meeting_url}`)
  for (const item of booking.questions ?? []) {
    if (item.question?.trim() && item.answer?.trim()) {
      rows.push(`${item.question.trim()}: ${item.answer.trim()}`)
    }
  }
  return rows.join("\n")
}

export async function syncTidyCalBookings(): Promise<TidyCalSyncResult> {
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin non configurato")

  const window = syncWindow()
  const [bookings, bookingTypes, leadsResult, clientsResult] = await Promise.all([
    listTidyCalBookings(window),
    listTidyCalBookingTypes(),
    supabase.from("leads").select("id,email").not("email", "is", null),
    supabase.from("clienti").select("id,email").not("email", "is", null),
  ])

  if (leadsResult.error) throw new Error(`Lettura lead: ${leadsResult.error.message}`)
  if (clientsResult.error) throw new Error(`Lettura clienti: ${clientsResult.error.message}`)

  const typeNames = new Map(bookingTypes.map((type) => [type.id, type.title]))
  const leadsByEmail = new Map<string, string>()
  const clientsByEmail = new Map<string, string>()
  for (const row of leadsResult.data ?? []) {
    const email = normalizedEmail(row.email as string | null)
    if (email && !leadsByEmail.has(email)) leadsByEmail.set(email, row.id as string)
  }
  for (const row of clientsResult.data ?? []) {
    const email = normalizedEmail(row.email as string | null)
    if (email && !clientsByEmail.has(email)) clientsByEmail.set(email, row.id as string)
  }

  let linkedToLeads = 0
  let linkedToClients = 0
  let cancelled = 0
  const rows = bookings.map((booking) => {
    const email = normalizedEmail(booking.contact?.email)
    // Un cliente e' piu' specifico di un lead: se la stessa email compare in
    // entrambe le anagrafiche, l'appuntamento segue la conversione a cliente.
    const clienteId = clientsByEmail.get(email) ?? null
    const leadId = clienteId ? null : (leadsByEmail.get(email) ?? null)
    if (clienteId) linkedToClients += 1
    else if (leadId) linkedToLeads += 1
    if (booking.cancelled_at) cancelled += 1

    const typeTitle = typeNames.get(booking.booking_type_id) ?? "Appuntamento"
    return {
      origine: "tidycal",
      external_id: String(booking.id),
      external_updated_at: booking.updated_at,
      external_cancelled_at: booking.cancelled_at,
      titolo: `${typeTitle} · ${booking.contact?.name || "Contatto TidyCal"}`,
      categoria_id: "tidycal",
      colore: null,
      inizio: booking.starts_at,
      fine: booking.ends_at,
      note: notesFor(booking, typeTitle),
      cliente_id: clienteId,
      lead_id: leadId,
      installatore_id: null,
      creato_da: null,
    }
  })

  // Supabase/PostgREST accetta payload ragionevoli in batch. I blocchi
  // evitano limiti di body quando un account TidyCal diventa molto grande.
  for (let index = 0; index < rows.length; index += 200) {
    const { error } = await supabase
      .from("eventi_calendario")
      .upsert(rows.slice(index, index + 200), { onConflict: "origine,external_id" })
    if (error) throw new Error(`Scrittura calendario TidyCal: ${error.message}`)
  }

  return {
    bookings: bookings.length,
    imported: rows.length,
    linkedToLeads,
    linkedToClients,
    cancelled,
    ...window,
  }
}
