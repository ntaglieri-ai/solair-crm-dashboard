import { requirePage } from "@/lib/permissions/server"
import { OffertaCommercialeClient } from "./offerta-commerciale-client"

export default async function OffertaCommercialePage() {
  await requirePage("offerta_commerciale")
  return <OffertaCommercialeClient />
}
