"use client"

import type { ReactNode } from "react"
import { usePermissions } from "@/lib/permissions/provider"
import type { FieldModuleKey } from "@/lib/permissions/field-catalog"

// Rende un campo solo se il ruolo di chi guarda puo' vederlo.
//
// Perche' un wrapper e non un controllo sparso: le regole per campo vivono in
// permessi_campo e arrivano nello snapshot come `fields[modulo][campo]`. Il
// motore le sa gia' leggere (canField/fieldAccess in lib/permissions/engine.ts)
// ma fino a oggi non le chiamava nessuno fuori dal pannello Permessi: le 179
// righe configurate erano inerti, e ogni ruolo vedeva tutto.
//
// La `campo` e' la chiave del catalogo (snake_case: "iban", "codice_fiscale"),
// non l'etichetta mostrata a schermo. E' la stessa chiave che il pannello
// Permessi scrive e che il motore indicizza: passare l'etichetta vorrebbe dire
// tenere allineate due liste di nomi invece di una.
//
// Questa e' una difesa di presentazione, non di accesso: chi arriva a
// PostgREST direttamente legge comunque la colonna. A fermarlo sono le policy
// RLS di riga, che sono un'altra cosa e stanno altrove.

export function CampoProtetto({
  modulo,
  campo,
  children,
  /** Cosa mostrare al posto del campo. Di default: niente. */
  fallback = null,
}: {
  modulo: FieldModuleKey
  campo: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const permissions = usePermissions()
  if (!permissions.canField(modulo, campo, "view")) return <>{fallback}</>
  return <>{children}</>
}

/**
 * Variante a predicato, per i casi in cui il campo non e' un nodo a se' —
 * una cella dentro una tabella, una voce di un array costruito prima del
 * render, una riga di riepilogo.
 */
export function useCampoVisibile(modulo: FieldModuleKey, campo: string): boolean {
  const permissions = usePermissions()
  return permissions.canField(modulo, campo, "view")
}
