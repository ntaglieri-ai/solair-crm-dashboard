const TIDYCAL_API_BASE = "https://tidycal.com/api"
const MAX_PAGES = 100

export interface TidyCalContact {
  id: number
  name: string
  email: string
  phone_number: string | null
  timezone: string | null
}

export interface TidyCalQuestion {
  id: number
  question: string
  answer: string
}

export interface TidyCalBooking {
  id: number
  booking_type_id: number
  starts_at: string
  ends_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  timezone: string | null
  meeting_url: string | null
  questions: TidyCalQuestion[]
  contact: TidyCalContact
}

export interface TidyCalBookingType {
  id: number
  title: string
  url: string | null
}

type Paginated<T> = { data: T[] }

function apiToken() {
  const token = process.env.TIDYCAL_API_TOKEN?.trim()
  if (!token) throw new Error("TIDYCAL_API_TOKEN non configurato")
  return token
}

async function tidyCalGet<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const url = new URL(`${TIDYCAL_API_BASE}${path}`)
  if (searchParams) url.search = searchParams.toString()

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiToken()}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300)
    throw new Error(`TidyCal API ${response.status}${detail ? `: ${detail}` : ""}`)
  }
  return (await response.json()) as T
}

async function allPages<T>(path: string, params = new URLSearchParams()): Promise<T[]> {
  const result: T[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageParams = new URLSearchParams(params)
    pageParams.set("page", String(page))
    const payload = await tidyCalGet<Paginated<T>>(path, pageParams)
    const rows = Array.isArray(payload.data) ? payload.data : []
    result.push(...rows)
    if (rows.length === 0) return result
  }
  throw new Error(`TidyCal: superato il limite di ${MAX_PAGES} pagine`)
}

export function listTidyCalBookings(params: { startsAt: string; endsAt: string }) {
  const search = new URLSearchParams({
    starts_at: params.startsAt,
    ends_at: params.endsAt,
    include_teams: "true",
  })
  return allPages<TidyCalBooking>("/bookings", search)
}

export function listTidyCalBookingTypes() {
  return allPages<TidyCalBookingType>("/booking-types")
}
