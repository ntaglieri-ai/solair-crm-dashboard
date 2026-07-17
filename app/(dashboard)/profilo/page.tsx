import { redirect } from "next/navigation"
import { UserRound } from "lucide-react"

import { ProfileForm } from "@/components/profile/profile-form"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { loadPersonalProfile } from "@/lib/profile/personal-profile"

export const dynamic = "force-dynamic"

export default async function ProfiloPage() {
  const snapshot = await loadCurrentPermissionSnapshot()
  if (!snapshot.subject.authUserId) redirect("/login")

  const profile = await loadPersonalProfile(snapshot)
  if (!profile) redirect("/login")

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
            <UserRound className="size-4" />
            Account personale
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Profilo</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Personalizza le informazioni visibili nel tuo account. L&apos;email di accesso resta
            gestita dagli amministratori.
          </p>
        </div>
      </header>

      <ProfileForm initialProfile={profile} />
    </div>
  )
}
