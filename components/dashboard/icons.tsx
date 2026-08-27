import {
  LayoutDashboard,
  Users,
  UserCheck,
  ListTodo,
  CalendarDays,
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
  BadgeEuro,
  type LucideIcon,
} from "lucide-react"

import type { NavItem, KpiData, FeedTipo } from "@/lib/mock-data"

export const NAV_ICONS: Record<NavItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users,
  clienti: UserCheck,
  compiti: ListTodo,
  calendario: CalendarDays,
  scadenze: CalendarClock,
  documenti: FileText,
  installatori: Wrench,
  offerta_commerciale: BadgeEuro,
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
