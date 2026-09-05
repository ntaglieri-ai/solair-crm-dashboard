import type { ReactNode } from "react"
import { ClienteTagProvider } from "@/lib/cliente-tag-store"
import { loadClienteReferenceData } from "@/lib/clienti/reference-data"

export default async function ClientiLayout({ children }: { children: ReactNode }) {
  const references = await loadClienteReferenceData()
  return <ClienteTagProvider initialData={references}>{children}</ClienteTagProvider>
}
