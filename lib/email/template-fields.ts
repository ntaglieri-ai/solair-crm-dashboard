// Catalogo dei campi referenziabili con {Campo} in un modello e-mail, per
// modulo. E' la stessa fonte (Clienti/Lead/Installatori RECORD_FIELDS) che
// lib/email/bulk-targets.ts usa per popolare `campi` all'invio: l'editor deve
// proporre esattamente le etichette che il motore di sostituzione riconosce,
// altrimenti un campo scelto dalla lista e uno scritto a mano rischiano di
// divergere.
import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"
import { INSTALLATORI_RECORD_FIELDS } from "@/lib/installatori/record-fields"

export type ModuloTemplate = "clienti" | "lead" | "installatori"

/**
 * Etichette dei campi del modulo, in ordine alfabetico: la lista arriva a
 * oltre cento voci su Clienti, e senza un ordine cercarci a occhio sarebbe
 * impraticabile quanto scriverle a mano.
 */
export function campiSegnapostoPerModulo(modulo: ModuloTemplate): string[] {
  const campi =
    modulo === "clienti"
      ? CLIENTI_RECORD_FIELDS.map((campo) => campo.appField)
      : modulo === "lead"
        ? LEAD_RECORD_FIELDS.map((campo) => campo.appField)
        : INSTALLATORI_RECORD_FIELDS.map((campo) => campo.appField)

  return [...new Set(campi)].sort((a, b) => a.localeCompare(b, "it"))
}
