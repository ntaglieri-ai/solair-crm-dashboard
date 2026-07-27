import type { ReactNode } from "react"
import { InstallatoreTagProvider } from "@/lib/installatore-tag-store"
import { loadInstallatoreReferenceData } from "@/lib/installatori/reference-data"

export default async function InstallatoriLayout({ children }: { children: ReactNode }) {
  const references = await loadInstallatoreReferenceData()
  return <InstallatoreTagProvider initialData={references}>{children}</InstallatoreTagProvider>
}
