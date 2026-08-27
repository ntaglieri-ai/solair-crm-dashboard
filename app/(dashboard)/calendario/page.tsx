// Server Component: pre-carica la finestra corrente (mese in corso) e le
// categorie, cosi' la griglia arriva gia' piena al primo paint.
import { requirePage } from "@/lib/permissions/server"
import { getCategorie, queryEventi } from "@/lib/calendario/repository"
import { rangeVista } from "@/lib/calendario/date-utils"
import { CalendarioClient } from "./calendario-client"

// Sempre dinamica: gli eventi dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function CalendarioPage() {
  await requirePage("calendario")

  // Il server calcola la finestra sul fuso del server, il client la
  // ricalcolera' sul proprio alla prima navigazione fra periodi. Per il
  // mese corrente la differenza e' al massimo di un giorno ai bordi, che
  // la griglia mostra comunque come giorni "fuori mese".
  const { da, a } = rangeVista(new Date(), "mese")
  const [eventi, categorie] = await Promise.all([
    queryEventi({ da, a }),
    getCategorie(),
  ])

  return <CalendarioClient eventiIniziali={eventi} categorieIniziali={categorie} />
}
