export type NavIcon =
  | "dashboard"
  | "leads"
  | "clienti"
  | "compiti"
  | "calendario"
  | "scadenze"
  | "documenti"
  | "installatori"
  | "offerta_commerciale"
  | "solair_ai"
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
  { label: "Calendario", href: "/calendario", icon: "calendario" },
]

export const NAV_GESTIONE: NavItem[] = [
  { label: "SolairAI", href: "/solair-ai", icon: "solair_ai" },
  { label: "Offerta Commerciale", href: "/offerta-commerciale", icon: "offerta_commerciale" },
  { label: "Scadenze", href: "/scadenze", icon: "scadenze" },
  { label: "Documenti", href: "/documenti", icon: "documenti" },
  { label: "Installatori", href: "/installatori", icon: "installatori" },
]

export const NAV_ADMIN: NavItem = {
  label: "CRM Settings & Admin",
  href: "/impostazioni",
  icon: "impostazioni",
}
