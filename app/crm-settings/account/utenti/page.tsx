import { createClient } from "@/lib/supabase/server"
import { AccountManagementClient } from "./account-management-client"

type Utente = {
  id: string
  nome: string
  email: string
  ruolo: string
  ruolo_id: string | null
  sede: string
  attivo: boolean
  created_at: string
}

type RuoloProfilo = {
  id: string
  code: string
  nome: string
}

async function loadAccountManagementData() {
  const supabase = await createClient()
  const [{ data: utenti, error: utentiError }, { data: ruoli, error: ruoliError }] =
    await Promise.all([
      supabase
        .from("utenti")
        .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
        .order("nome"),
      supabase
        .from("ruoli")
        .select("id, code, nome")
        .order("ordinamento", { ascending: true }),
    ])

  const error = utentiError ?? ruoliError

  return {
    initialUsers: ((utenti ?? []) as Utente[]).map((utente) => ({
      ...utente,
      ruolo: utente.ruolo ?? "",
      sede: utente.sede ?? "",
      attivo: utente.attivo !== false,
    })),
    initialRoles: ((ruoli ?? []) as RuoloProfilo[]).map((ruolo) => ({
      ...ruolo,
      code: ruolo.code ?? "",
    })),
    initialError: error?.message ?? null,
  }
}

export default async function AccountManagementPage() {
  const data = await loadAccountManagementData()
  return <AccountManagementClient {...data} />
}
