import type { Lead } from "@/lib/mock-data"

function phoneValue(value: string | null | undefined) {
  const trimmed = (value ?? "").trim()
  if (!trimmed || trimmed === "—" || trimmed === "-") return ""
  return /\d/.test(trimmed) ? trimmed : ""
}

export function leadPrimaryPhone(
  lead: Pick<Partial<Lead>, "Telefono" | "Mobile/Fisso">,
) {
  return phoneValue(lead.Telefono) || phoneValue(lead["Mobile/Fisso"])
}
