import type { PermissionSnapshot } from "@/lib/permissions/types"

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

export function currentAccountProfileFromSnapshot(
  snapshot: PermissionSnapshot,
): CurrentAccountProfile | null {
  const subject = snapshot.subject
  if (!subject.authUserId) return null
  return {
    id: subject.userId,
    authUserId: subject.authUserId,
    nome: subject.nome,
    email: subject.email ?? "",
    sede: subject.sede,
    attivo: true,
    ruoloId: subject.ruoloId,
    ruoloCode: subject.ruoloCode,
    ruoloNome: subject.ruoloNome,
    linked: Boolean(subject.userId && subject.ruoloId),
  }
}
