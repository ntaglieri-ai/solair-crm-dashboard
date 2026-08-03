import { getNextcloudAppPassword, getNextcloudUsername } from "@/lib/nextcloud/credentials"
import { nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"

export async function commercialNextcloudUser(subject: {
  userId: string | null
  email: string | null
}) {
  if (!subject.userId || !subject.email) throw new Error("Utente CRM non risolto")
  const appPassword = await getNextcloudAppPassword(subject.userId)
  if (!appPassword) throw new Error("Account Nextcloud non collegato. Collegalo dal profilo CRM.")
  const username =
    (await getNextcloudUsername(subject.userId)) ??
    nextcloudUsernameFromEmail(subject.email)
  return { username, appPassword }
}
