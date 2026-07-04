export type NavIcon =
  | "dashboard"
  | "leads"
  | "clienti"
  | "compiti"
  | "scadenze"
  | "documenti"
  | "installatori"
  | "impostazioni"

export type NavItem = {
  label: string
  href: string
  icon: NavIcon
}

export const NAV_PRINCIPALE: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Lead", href: "/leads", icon: "leads" },
  { label: "Clienti", href: "/clienti", icon: "clienti" },
  { label: "Compiti", href: "/compiti", icon: "compiti" },
]

export const NAV_GESTIONE: NavItem[] = [
  { label: "Scadenze", href: "/scadenze", icon: "scadenze" },
  { label: "Documenti", href: "/documenti", icon: "documenti" },
  { label: "Installatori", href: "/installatori", icon: "installatori" },
]

export const NAV_ADMIN: NavItem = {
  label: "CRM Settings & Admin",
  href: "/impostazioni",
  icon: "impostazioni",
}
