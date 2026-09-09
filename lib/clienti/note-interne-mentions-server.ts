import { NOTE_INTERNE_CLIENTI } from "@/lib/notes/note-interne-config"
import {
  canMentionInternalUser as canMentionInternalUserGenerico,
  internalMentionUsers as internalMentionUsersGenerico,
  resolveInternalMentions as resolveInternalMentionsGenerico,
  notifyInternalMentions as notifyInternalMentionsGenerico,
} from "@/lib/notes/note-interne-mentions-server"
import type { NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"

/**
 * Note interne del Cliente.
 *
 * La logica sta in @/lib/notes/note-interne-mentions-server, condivisa con
 * Installatori: e' codice di sicurezza, e due copie che divergono sono
 * peggio di una sola parametrica. Qui resta solo l'aggancio alla
 * configurazione del modulo, cosi' le route del Cliente non cambiano.
 */

/**
 * Esposta per i test gia' esistenti: verificano il gate del Cliente senza
 * sapere della configurazione per modulo, e continuano a valere invariati.
 */
export function canMentionInternalUser(
  params: Omit<Parameters<typeof canMentionInternalUserGenerico>[0], "config">,
) {
  return canMentionInternalUserGenerico({ ...params, config: NOTE_INTERNE_CLIENTI })
}

export function internalMentionUsers(clienteId: string) {
  return internalMentionUsersGenerico(NOTE_INTERNE_CLIENTI, clienteId)
}

export function resolveInternalMentions(
  clienteId: string,
  text: string,
  drafts: NoteMentionDraft[],
) {
  return resolveInternalMentionsGenerico(NOTE_INTERNE_CLIENTI, clienteId, text, drafts)
}

export function notifyInternalMentions(params: {
  text: string
  clienteId: string
  mentions: NoteMention[]
  previous?: NoteMention[]
  authorId: string | null
  authorName: string
}) {
  const { clienteId, ...resto } = params
  return notifyInternalMentionsGenerico({
    ...resto,
    config: NOTE_INTERNE_CLIENTI,
    recordId: clienteId,
  })
}
