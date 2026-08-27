/**
 * Aritmetica di calendario in ORA LOCALE.
 *
 * Gli eventi sono timestamptz e viaggiano in ISO/UTC; la griglia invece
 * e' quella che l'utente vede sul suo fuso. Costruire le celle in UTC
 * sposterebbe di un giorno gli eventi serali quando l'Italia e' in ora
 * legale. Tutte le funzioni qui lavorano su Date locali; la conversione
 * a ISO avviene solo al confine (query e form).
 */

export const GIORNI_SETTIMANA = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]

export function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date)
  // Il giorno 1 evita il rimbalzo di setMonth: dal 31 gennaio +1 mese si
  // finirebbe al 2 o 3 marzo invece che a febbraio.
  copy.setDate(1)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

/** Lunedi' della settimana che contiene `date`. */
export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date)
  const giorno = (copy.getDay() + 6) % 7
  return addDays(copy, -giorno)
}

export function startOfMonth(date: Date): Date {
  const copy = startOfDay(date)
  copy.setDate(1)
  return copy
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(date: Date): boolean {
  return sameDay(date, new Date())
}

/**
 * Le 42 celle della vista mensile: sei settimane piene a partire dal
 * lunedi' che precede il primo del mese. Sempre sei, cosi' la griglia non
 * cambia altezza passando da un mese all'altro.
 */
export function monthGrid(date: Date): Date[] {
  const inizio = startOfWeek(startOfMonth(date))
  return Array.from({ length: 42 }, (_, i) => addDays(inizio, i))
}

export function weekGrid(date: Date): Date[] {
  const inizio = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(inizio, i))
}

/** Estremi [da, a) della finestra da chiedere all'API per una vista. */
export function rangeVista(date: Date, vista: "mese" | "settimana") {
  const celle = vista === "mese" ? monthGrid(date) : weekGrid(date)
  return {
    da: celle[0].toISOString(),
    a: addDays(celle[celle.length - 1], 1).toISOString(),
  }
}

/** Date -> valore per <input type="datetime-local"> (ora locale). */
export function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** Valore di <input type="datetime-local"> -> ISO UTC. */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const ORA = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" })
const GIORNO_LUNGO = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
})
const MESE_ANNO = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" })
const DATA_ORA = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatOra(iso: string): string {
  return ORA.format(new Date(iso))
}

export function formatGiornoLungo(date: Date): string {
  return GIORNO_LUNGO.format(date)
}

export function formatMeseAnno(date: Date): string {
  return MESE_ANNO.format(date)
}

export function formatDataOra(iso: string): string {
  return DATA_ORA.format(new Date(iso))
}

/** "12 – 18 agosto 2026", con il mese ripetuto solo se cambia. */
export function formatIntervalloSettimana(date: Date): string {
  const giorni = weekGrid(date)
  const primo = giorni[0]
  const ultimo = giorni[6]
  const stessoMese = primo.getMonth() === ultimo.getMonth()
  const formatoPrimo = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    ...(stessoMese ? {} : { month: "long" }),
  })
  const formatoUltimo = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return `${formatoPrimo.format(primo)} – ${formatoUltimo.format(ultimo)}`
}
