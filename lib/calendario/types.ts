import type { RoleCode } from "@/lib/permissions/types"

/** Chiave della configurazione categorie in `crm_settings`. */
export const CALENDARIO_CATEGORIE_KEY = "system.calendario.categorie"

/**
 * Ruoli che modificano qualsiasi evento, non solo il proprio. Speculare
 * a public.has_full_row_visibility() in DB, che e' il gate usato dalle
 * policy di update/delete su eventi_calendario.
 */
export const CALENDARIO_ADMIN_ROLES: RoleCode[] = ["SUPERADMIN", "ADMIN", "DIRECTOR"]

/** Ruoli che gestiscono le categorie (nome + colore di default). */
export const CALENDARIO_CATEGORIE_ROLES: RoleCode[] = ["SUPERADMIN", "ADMIN"]

export interface CategoriaCalendario {
  id: string
  nome: string
  colore: string
}

/**
 * Set iniziale, replicato dalla migration 20260827b. Serve da fallback
 * se la riga di crm_settings viene cancellata: il calendario resta
 * usabile invece di rifiutare ogni inserimento per categoria mancante.
 */
export const CATEGORIE_DEFAULT: CategoriaCalendario[] = [
  { id: "lead", nome: "Lead", colore: "#3b82f6" },
  { id: "cliente", nome: "Cliente", colore: "#2e8b72" },
  { id: "installazione", nome: "Installazione", colore: "#f59e0b" },
  { id: "compito", nome: "Compito", colore: "#8b5cf6" },
  { id: "scadenza", nome: "Scadenza", colore: "#dc2626" },
  { id: "tidycal", nome: "TidyCal", colore: "#0ea5e9" },
]

/** Colore di un evento la cui categoria non esiste piu' nella config. */
export const COLORE_FALLBACK = "#64748b"

export type EventoCorrelatoTipo = "cliente" | "lead" | "installatore"

export interface EventoCalendario {
  id: string
  titolo: string
  categoria_id: string
  /** null = eredita il colore di default della categoria. */
  colore: string | null
  inizio: string
  fine: string | null
  note: string | null
  cliente_id: string | null
  lead_id: string | null
  installatore_id: string | null
  creato_da: string | null
  creato_da_nome: string | null
  origine: "crm" | "tidycal"
  external_id: string | null
  external_updated_at: string | null
  external_cancelled_at: string | null
  /**
   * Tipo e nome del record collegato, risolti in lettura dal
   * repository. Non sono colonne: le colonne sono i tre *_id, e al
   * massimo uno e' valorizzato.
   */
  correlato_tipo: EventoCorrelatoTipo | null
  correlato_nome: string | null
  created_at: string
  updated_at: string
}

export const CORRELATO_COLONNA: Record<EventoCorrelatoTipo, keyof EventoCalendario> = {
  cliente: "cliente_id",
  lead: "lead_id",
  installatore: "installatore_id",
}

const HEX = /^#[0-9a-f]{6}$/i

export function isColoreValido(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value)
}

/**
 * Normalizza la config letta da crm_settings. La riga e' jsonb libero:
 * una voce malformata (id mancante, colore non esadecimale) verrebbe
 * accettata dal DB e romperebbe il render, quindi si scarta qui.
 * Se non resta nulla di valido si ricade sul set iniziale.
 */
export function parseCategorie(value: unknown): CategoriaCalendario[] {
  if (!Array.isArray(value)) return CATEGORIE_DEFAULT

  const viste = new Set<string>()
  const categorie: CategoriaCalendario[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue
    const voce = raw as Record<string, unknown>
    const id = typeof voce.id === "string" ? voce.id.trim() : ""
    const nome = typeof voce.nome === "string" ? voce.nome.trim() : ""
    if (!id || !nome || viste.has(id)) continue
    viste.add(id)
    categorie.push({
      id,
      nome,
      colore: isColoreValido(voce.colore) ? voce.colore.toLowerCase() : COLORE_FALLBACK,
    })
  }

  return categorie.length > 0 ? categorie : CATEGORIE_DEFAULT
}

/** Slug stabile per una categoria nuova, a partire dal nome digitato. */
export function slugCategoria(nome: string): string {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `categoria_${Date.now()}`
  )
}

export function categoriaDi(
  evento: Pick<EventoCalendario, "categoria_id">,
  categorie: CategoriaCalendario[],
): CategoriaCalendario | null {
  return categorie.find((categoria) => categoria.id === evento.categoria_id) ?? null
}

/**
 * Colore effettivo: override dell'evento se c'e', altrimenti il default
 * della categoria, altrimenti il grigio di fallback (categoria
 * cancellata dalla config dopo la creazione dell'evento).
 */
export function coloreEvento(
  evento: Pick<EventoCalendario, "categoria_id" | "colore">,
  categorie: CategoriaCalendario[],
): string {
  if (isColoreValido(evento.colore)) return evento.colore
  return categoriaDi(evento, categorie)?.colore ?? COLORE_FALLBACK
}

export function nomeCategoria(
  evento: Pick<EventoCalendario, "categoria_id">,
  categorie: CategoriaCalendario[],
): string {
  return categoriaDi(evento, categorie)?.nome ?? "Senza categoria"
}

/**
 * Speculare alle policy di update/delete: l'autore, piu' i ruoli che
 * vedono tutto. Usata solo per decidere cosa mostrare — se sbagliasse,
 * la RLS respingerebbe comunque la scrittura.
 */
export function puoModificareEvento(
  evento: Pick<EventoCalendario, "creato_da" | "origine">,
  subject: { userId: string | null; ruoloCode: string },
): boolean {
  if (evento.origine !== "crm") return false
  if (CALENDARIO_ADMIN_ROLES.includes(subject.ruoloCode.toUpperCase())) return true
  return Boolean(subject.userId) && evento.creato_da === subject.userId
}

export function puoGestireCategorie(ruoloCode: string | null | undefined): boolean {
  return CALENDARIO_CATEGORIE_ROLES.includes((ruoloCode ?? "").trim().toUpperCase())
}
