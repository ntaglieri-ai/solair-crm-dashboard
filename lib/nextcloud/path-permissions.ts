// Regole di visibilita' per-path sui documenti Nextcloud.
// Lista ORDINATA: vince il primo prefisso che matcha. Applicata SEMPRE
// server-side prima di restituire listing o link al client — mai solo in UI.
//
// Nota gap (owner-scoping): le regole "owner del cliente OPPURE Director+"
// sono implementate qui come Director+ perche' non esiste ancora un mapping
// path -> cliente lato server. L'owner-scoping fine e' documentato come TODO
// nel report; il tier Director+ resta comunque enforced.

import type { RoleCode } from "@/lib/permissions/types"

const DIRECTOR_PLUS: RoleCode[] = ["DIRECTOR", "ADMIN", "SUPERADMIN"]
const ADMIN_PLUS: RoleCode[] = ["ADMIN", "SUPERADMIN"]

// roles === null  => visibile a tutti i ruoli
type PathRule = {
  prefix: string
  roles: RoleCode[] | null
  ownerOrRoles?: boolean
  note?: string
}

// Prefissi relativi alla root "files" dell'utente, senza slash iniziale.
const RULES: PathRule[] = [
  { prefix: "Vendita-Digitale/Clienti 2.0/", roles: DIRECTOR_PLUS, ownerOrRoles: true },
  { prefix: "My-Space/Apps/Zoho CRM/Clienti/", roles: DIRECTOR_PLUS, ownerOrRoles: true },
  { prefix: "Vendita-Digitale/Finanziaria/", roles: DIRECTOR_PLUS },
  { prefix: "Solair-Agenti/Finanziaria", roles: DIRECTOR_PLUS },
  { prefix: "Solair-Agenti/FINANZIAMENTI", roles: DIRECTOR_PLUS },
  { prefix: "Solair-Ufficio/VIOLA/Firme E Timbri/", roles: ADMIN_PLUS },
  { prefix: "Solair-Ufficio/Old", roles: DIRECTOR_PLUS },
  { prefix: "Vendita-Digitale/Old", roles: DIRECTOR_PLUS },
  { prefix: "LISTINI", roles: null },
  { prefix: "Schede tecniche", roles: null },
  { prefix: "INSERZIONI ATTIVE", roles: null },
  { prefix: "Sponsorizzate", roles: null },
]

/** Normalizza un path: rimuove slash iniziali e sequenze doppie. */
export function normalizeNcPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/{2,}/g, "/")
}

function roleAllowed(roles: RoleCode[] | null, roleCode: RoleCode): boolean {
  if (roles === null) return true
  const rc = (roleCode ?? "").toUpperCase()
  return roles.some((r) => r.toUpperCase() === rc)
}

/**
 * Il ruolo puo' accedere al path? Vince la prima regola che matcha; se nessuna
 * regola matcha il default e' "visibile a tutti" (i prefissi ristretti sono
 * enumerati esplicitamente).
 */
export function canAccessNcPath(path: string, roleCode: RoleCode): boolean {
  const normalized = normalizeNcPath(path)
  for (const rule of RULES) {
    if (normalized.startsWith(rule.prefix)) {
      return roleAllowed(rule.roles, roleCode)
    }
  }
  return true
}

/** Filtra una lista di entry (con .path) tenendo solo quelle accessibili. */
export function filterNcEntriesByRole<T extends { path: string }>(
  entries: T[],
  roleCode: RoleCode,
): T[] {
  return entries.filter((e) => canAccessNcPath(e.path, roleCode))
}
