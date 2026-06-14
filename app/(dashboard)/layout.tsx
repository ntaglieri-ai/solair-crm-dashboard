import type { ReactNode } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-[228px]">
        <Topbar />
        <main className="flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  )
}
