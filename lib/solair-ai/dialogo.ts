import type { EntitaAI } from "./tipi"

const SELEZIONI_ENTITA = new Map<string, EntitaAI>([
  ["lead", "lead"],
  ["leads", "lead"],
  ["il lead", "lead"],
  ["un lead", "lead"],
  ["cliente", "cliente"],
  ["clienti", "cliente"],
  ["il cliente", "cliente"],
  ["un cliente", "cliente"],
  ["i clienti", "cliente"],
  ["installatore", "installatore"],
  ["installatori", "installatore"],
  ["l installatore", "installatore"],
  ["un installatore", "installatore"],
  ["gli installatori", "installatore"],
])

function normalizzaTestoDialogo(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/'/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function entitaDaSelezioneSemplice(messaggio: string): EntitaAI | null {
  const testo = normalizzaTestoDialogo(messaggio)
  if (testo === "") return null

  return SELEZIONI_ENTITA.get(testo) ?? null
}
