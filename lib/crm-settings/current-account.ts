import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

export type CurrentAccountProfile = {
  id: string | null
  authUserId: string
  nome: string
  email: string
  sede: string | null
  attivo: boolean
  ruoloId: string | null
  ruoloCode: string | null
  ruoloNome: string
  linked: boolean
}

async function loadCurrentAccountProfileUncached(): Promise<CurrentAccountProfile | null> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const columns = "id, auth_user_id, nome, email, ruolo, ruolo_id, sede, attivo"
  const { data: linkedUser } = await supabase
    .from("utenti")
    .select(columns)
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  let account = linkedUser
  if (!account && authUser.email) {
    const { data: emailUser } = await supabase
      .from("utenti")
      .select(columns)
      .ilike("email", authUser.email)
      .maybeSingle()
    account = emailUser

    if (account && !account.auth_user_id) {
      await supabase
        .from("utenti")
        .update({ auth_user_id: authUser.id })
        .eq("id", account.id)
        .is("auth_user_id", null)
      account = { ...account, auth_user_id: authUser.id }
    }
  }

  let role: { id: string; code: string; nome: string } | null = null
  if (account?.ruolo_id) {
    const { data } = await supabase
      .from("ruoli")
      .select("id, code, nome")
      .eq("id", account.ruolo_id)
      .maybeSingle()
    role = data
  }
  if (!role && account?.ruolo) {
    const { data } = await supabase
      .from("ruoli")
      .select("id, code, nome")
      .ilike("code", account.ruolo)
      .maybeSingle()
    role = data
  }

  const metadataName =
    authUser.user_metadata?.full_name ??
    authUser.user_metadata?.name ??
    authUser.email?.split("@")[0] ??
    "Utente"

  return {
    id: account?.id ?? null,
    authUserId: authUser.id,
    nome: account?.nome ?? metadataName,
    email: account?.email ?? authUser.email ?? "",
    sede: account?.sede ?? null,
    attivo: account?.attivo !== false,
    ruoloId: role?.id ?? account?.ruolo_id ?? null,
    ruoloCode: role?.code ?? account?.ruolo ?? null,
    ruoloNome: role?.nome ?? "Profilo non collegato",
    linked: Boolean(account && role),
  }
}

export const loadCurrentAccountProfile = cache(
  loadCurrentAccountProfileUncached,
)
