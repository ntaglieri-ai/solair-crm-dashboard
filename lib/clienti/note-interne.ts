import type { RoleCode } from "@/lib/permissions/types"
import type { NoteMention } from "@/lib/notes/mentions"

/**
 * Ruoli che vedono le note interne. Deve restare allineato al gate SQL
 * public.note_interne_can_access() (migration 20260827): la RLS e'
 * l'enforcement vero, questa lista serve a non disegnare una UI che poi
 * tornerebbe sempre vuota, e a rispondere 404 sulle route.
 */
// Modulo isomorfo: lo importa anche il componente client della sezione.
// Il guard delle route vive in ./note-interne-guard, che tira dentro
// lib/permissions/server e con esso next/headers — importarlo da qui
// trascinerebbe codice server nel bundle del browser, e il build si
// ferma con "does not support external modules (node:async_hooks)".
export const NOTE_INTERNE_ROLES: RoleCode[] = ["SUPERADMIN", "ADMIN", "DIRECTOR"]

export function canAccessNoteInterne(ruoloCode: string | null | undefined): boolean {
  return NOTE_INTERNE_ROLES.includes((ruoloCode ?? "").trim().toUpperCase())
}

export interface NotaInterna {
  id: string
  contenuto: string
  menzioni?: NoteMention[]
  creato_da: string | null
  creato_da_nome: string | null
  creato_il: string
  modificato_da: string | null
  modificato_da_nome: string | null
  modificato_il: string | null
}
