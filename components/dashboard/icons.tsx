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
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import type { KpiData, FeedTipo } from "@/lib/mock-data"
import type { NavIcon } from "@/lib/navigation"

// Tipizzata su NavIcon di lib/navigation e non sull'omonimo NavItem di
// mock-data: la barra laterale disegna le voci di lib/navigation, quindi e'
// quella l'unione che deve restare allineata. Le due sono rimaste identiche
// fino a oggi per caso, e la copia in mock-data serve ai dati di esempio.
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users,
  clienti: UserCheck,
  compiti: ListTodo,
  calendario: CalendarDays,
  scadenze: CalendarClock,
  documenti: FileText,
  installatori: Wrench,
  offerta_commerciale: BadgeEuro,
  solair_ai: Sparkles,
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
