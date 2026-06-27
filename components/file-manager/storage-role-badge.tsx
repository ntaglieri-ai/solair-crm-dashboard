import { cn } from "@/lib/utils"
import { STORAGE_ROLE_CLASS, storageRoleColor } from "@/lib/file-manager-data"

/** Badge colorato per un ruolo storage (Superadmin, Amministratore, …). */
export function StorageRoleBadge({
  ruolo,
  className,
}: {
  ruolo: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        STORAGE_ROLE_CLASS[storageRoleColor(ruolo)],
        className,
      )}
    >
      {ruolo}
    </span>
  )
}
