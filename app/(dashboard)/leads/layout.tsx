import type { ReactNode } from "react"
import { TagProvider } from "@/lib/tag-store"

export default function LeadsLayout({ children }: { children: ReactNode }) {
  return <TagProvider>{children}</TagProvider>
}
