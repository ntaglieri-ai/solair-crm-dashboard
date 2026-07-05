import type { ReactNode } from "react"
import { TagProvider } from "@/lib/tag-store"
import { loadLeadReferenceData } from "@/lib/leads/reference-data"

export default async function LeadsLayout({ children }: { children: ReactNode }) {
  const references = await loadLeadReferenceData()
  return <TagProvider initialData={references}>{children}</TagProvider>
}
