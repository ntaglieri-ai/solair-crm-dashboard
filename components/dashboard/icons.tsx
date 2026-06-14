import {
  LayoutDashboard,
  Users,
  UserCheck,
  ListTodo,
  CalendarClock,
  FileText,
  Wrench,
  Settings,
  Flame,
  Briefcase,
  TriangleAlert,
  Mail,
  UserPlus,
  FileSignature,
  Clock,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react"

import type { NavItem, KpiData, FeedTipo } from "@/lib/mock-data"

export const NAV_ICONS: Record<NavItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users,
  clienti: UserCheck,
  compiti: ListTodo,
  scadenze: CalendarClock,
  documenti: FileText,
  installatori: Wrench,
  impostazioni: Settings,
}

export const KPI_ICONS: Record<KpiData["icon"], LucideIcon> = {
  users: Users,
  flame: Flame,
  briefcase: Briefcase,
  alert: TriangleAlert,
}

export const FEED_ICONS: Record<FeedTipo, LucideIcon> = {
  "email-open": Mail,
  "nuovo-lead": UserPlus,
  "compito-scaduto": TriangleAlert,
  "contratto-firmato": FileSignature,
  "lead-fermo": Clock,
  conversione: ArrowRightLeft,
}
