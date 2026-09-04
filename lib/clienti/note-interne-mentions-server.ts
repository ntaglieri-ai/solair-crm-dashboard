import { createAdminClient } from "@/lib/supabase/admin"
import { buildDefaultPermissionSnapshot } from "@/lib/permissions/constants"
import { createPermissionEngine } from "@/lib/permissions/engine"
import { applyUiPermission } from "@/lib/permissions/load-permissions"
import { NOTE_INTERNE_ROLES } from "./note-interne"
import { sanitizeNoteMentions, type NoteMention, type NoteMentionDraft } from "@/lib/notes/mentions"
import { sendDirectEmail } from "@/lib/email/mailer"

type UiPermission = { chiave: string; abilitato: boolean | null }
type Candidate = {
  id: string; nome: string; email: string | null; attivo: boolean; auth_user_id: string | null
  ruolo: string | null; ruolo_id: string | null
}
type Role = { id: string; code: string | null; nome: string | null }
type Action = { azione: string; abilitato: boolean | null }
type Page = { pagina: string; accesso: string | boolean | null }
type RecordPermission = { modulo: string; azione: string; abilitato: boolean | null }

/** Intersezione del gate SQL, permessi applicativi e perimetro proprietario/team.
 * Nessuna impersonificazione del destinatario e nessun ampliamento della RLS.
 */
export function canMentionInternalUser(params: {
  user: Candidate; role?: Role; ui: UiPermission[]; actions: Action[]
  pages: Page[]; records: RecordPermission[]; ownerId: string | null; teamOwner: boolean
}) {
  const { user, role, ui, actions, pages, records, ownerId, teamOwner } = params
  // Lo stesso coalesce del gate SQL; un ruolo custom non eredita accesso dal nome legacy.
  const roleCode = (role?.code ?? role?.nome ?? user.ruolo ?? "").toUpperCase()
  if (!user.attivo || !user.auth_user_id || !user.nome || !NOTE_INTERNE_ROLES.includes(roleCode)) return false
  const snapshot = buildDefaultPermissionSnapshot({ userId: user.id, ruoloCode: roleCode })
  const defaultScope = snapshot.scopes.clienti
  const explicit = ui.filter((row) => row.abilitato && row.chiave.startsWith("scope:clienti:"))
  // Configurazioni ambigue: fail closed, non scegliere arbitrariamente lo scope più ampio.
  if (new Set(explicit.map((row) => row.chiave)).size > 1) return false
  const hasScopes = ui.some((row) => row.abilitato && row.chiave.startsWith("scope:"))
  for (const row of ui) {
    if (hasScopes && row.chiave === "visibilita_sedi") continue
    applyUiPermission(snapshot, row)
  }
  for (const row of actions) snapshot.actions[row.azione] = row.abilitato === true
  for (const row of pages) snapshot.pages[row.pagina] = row.accesso === true || row.accesso === "rw"
    ? "rw" : row.accesso === "r" ? "r" : "no_access"
  for (const row of records) {
    snapshot.records[row.modulo] ??= {}
    snapshot.records[row.modulo][row.azione] = row.abilitato === true
  }
  const permissions = createPermissionEngine(snapshot)
  if (!permissions.canAction("clienti.note_interne.view") || !permissions.canPage("clienti") || !permissions.canRecord("clienti", "view")) return false
  if (permissions.isSuperadmin) return true
  const inScope = (scope: string) => scope === "all" || (
    Boolean(ownerId) && (scope === "team" ? ownerId === user.id || teamOwner
      : ["own", "assigned", "own_sede"].includes(scope) && ownerId === user.id)
  )
  // Il DB ignora visibilita_sedi legacy: richiediamo ENTRAMBI gli scope.
  const dbScope = explicit[0]?.chiave.split(":")[2] ?? defaultScope
  return inScope(permissions.getScope("clienti")) && inScope(dbScope)
}

/** Chiamare solo dopo requireApiNoteInterne(clienteId). Le letture privilegiate
 * servono a verificare i permessi del DESTINATARIO, non quelli del mittente.
 * Nessuna cache: revoche di ruolo/team devono avere effetto al salvataggio.
 */
export async function internalMentionUsers(clienteId: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error("Verifica destinatari non disponibile")
  const results = await Promise.all([
    admin.from("clienti").select("clienti_proprietario_id").eq("id", clienteId).maybeSingle(),
    admin.from("utenti").select("id,nome,email,attivo,auth_user_id,ruolo,ruolo_id").eq("attivo", true),
    admin.from("ruoli").select("id,code,nome"),
    admin.from("permessi_ui").select("ruolo_id,chiave,abilitato")
      .or("chiave.like.scope:%,chiave.eq.visibilita_sedi,chiave.eq.clienti.note_interne.view"),
    admin.from("permessi_azione").select("ruolo_id,azione,abilitato").eq("azione", "clienti.note_interne.view"),
    admin.from("permessi_pagina").select("ruolo_id,pagina,accesso").eq("pagina", "clienti"),
    admin.from("permessi_record").select("ruolo_id,modulo,azione,abilitato").eq("modulo", "clienti").eq("azione", "view"),
    admin.from("team_direttori").select("team_id,utente_id"),
    admin.from("team_agenti").select("team_id,utente_id"),
  ])
  if (results.some((result) => result.error)) throw new Error("Verifica destinatari non disponibile")
  // PostgREST limita normalmente le risposte a 1000 righe: non applicare default
  // permissivi se un elenco di autorizzazioni potrebbe essere stato troncato.
  if (results.some((result) => Array.isArray(result.data) && result.data.length >= 1000)) {
    throw new Error("Verifica destinatari incompleta")
  }
  const [cliente, users, roles, ui, actions, pages, records, directors, agents] = results
  if (!cliente.data) return []
  const ownerId = cliente.data.clienti_proprietario_id as string | null
  const ownerTeams = new Set((agents.data ?? []).filter((row) => row.utente_id === ownerId).map((row) => row.team_id))
  return ((users.data ?? []) as Candidate[]).filter((user) => canMentionInternalUser({
    user,
    role: (roles.data as Role[]).find((role) => role.id === user.ruolo_id),
    ui: (ui.data ?? []).filter((row) => row.ruolo_id === user.ruolo_id),
    actions: (actions.data ?? []).filter((row) => row.ruolo_id === user.ruolo_id),
    pages: (pages.data ?? []).filter((row) => row.ruolo_id === user.ruolo_id),
    records: (records.data ?? []).filter((row) => row.ruolo_id === user.ruolo_id),
    ownerId,
    teamOwner: (directors.data ?? []).some((row) => row.utente_id === user.id && ownerTeams.has(row.team_id)),
  })).map(({ id, nome, email }) => ({ id, nome, email })).sort((a, b) => a.nome.localeCompare(b.nome, "it"))
}

export async function resolveInternalMentions(clienteId: string, text: string, drafts: NoteMentionDraft[]) {
  if (!drafts.length) return []
  const users = await internalMentionUsers(clienteId)
  const mentions = sanitizeNoteMentions(text, drafts, users)
  if (mentions.some((mention, i) => i > 0 && mention.start < mentions[i - 1].end)) {
    throw new Error("Menzioni sovrapposte: rimuovile e seleziona nuovamente gli utenti")
  }
  // Non salvare in silenzio una menzione il cui destinatario ha perso accesso.
  if (drafts.some((draft) => !mentions.some((m) => m.userId === draft.userId && m.start === draft.start && m.end === draft.end))) {
    throw new Error("Una menzione non è valida o il destinatario non può leggere queste note. Rimuovila e seleziona nuovamente l’utente.")
  }
  return mentions
}

export async function notifyInternalMentions(params: {
  text: string; clienteId: string; mentions: NoteMention[]; previous?: NoteMention[]
  authorId: string | null; authorName: string
}) {
  const previousIds = new Set((params.previous ?? []).map((mention) => mention.userId))
  const ids = new Set(params.mentions.map((mention) => mention.userId).filter((id) => id !== params.authorId && !previousIds.has(id)))
  if (!ids.size) return 0
  try {
    // Il testo scritto viene inviato solo dopo il salvataggio e un nuovo
    // controllo dei destinatari. Nessun avviso sostitutivo o link automatico.
    const users = await internalMentionUsers(params.clienteId)
    const recipients = users.flatMap((user) => ids.has(user.id) && user.email ? [{ ...user, email: user.email }] : [])
    const results = await Promise.allSettled(recipients.map((recipient) => sendDirectEmail({
      to: recipient.email,
      subject: `${params.authorName} ti ha menzionato in una nota interna`,
      body: params.text,
    })))
    const failures = results.filter((result) => result.status === "rejected" || !result.value.ok).length
    return failures + ids.size - recipients.length
  } catch {
    // La nota è già salvata: un errore email non deve provocare reinserimenti.
    return ids.size
  }
}
