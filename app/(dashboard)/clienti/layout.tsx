import type { ReactNode } from "react"
import { ClienteTagProvider } from "@/lib/cliente-tag-store"

export default function ClientiLayout({ children }: { children: ReactNode }) {
  return <ClienteTagProvider>{children}</ClienteTagProvider>
}
