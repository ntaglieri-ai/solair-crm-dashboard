import { redirect } from "next/navigation"

/**
 * I valori predefiniti si gestiscono in Campi e attributi, accanto al campo a
 * cui appartengono.
 *
 * Questa pagina mostrava gli stessi valori in un secondo posto, leggendoli
 * pero' da una copia tenuta in un blob di impostazioni invece che da
 * crm_column_values. Le due viste divergevano in silenzio: cancellare un
 * valore qui sembrava funzionare e non cambiava niente nel CRM.
 *
 * Resta come reindirizzamento invece di sparire perche' l'indirizzo e' finito
 * in link e segnalibri, e un 404 al posto di una pagina che c'era non aiuta
 * nessuno a capire dove sia finita.
 */
export default function ValoriPage() {
  redirect("/crm-settings/system/attributi")
}
