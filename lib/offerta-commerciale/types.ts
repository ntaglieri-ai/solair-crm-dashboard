export type PrezzoFotovoltaico = { kwp: number; prezzo: number }

export type MatriceAccumulo = {
  marca: string
  garanzia_anni?: number | null
  ip?: string | null
  tensione?: string | null
  taglie: number[]
  prezzi: Record<string, number[]>
}

export type AccessorioCommerciale = {
  nome: string
  prezzo: number
  prezzo_combo?: number | null
  unita: string
  scontabile: boolean
}

export type RegolaSconto = {
  zona: string
  kwp_min: number
  kwp_max: number
  percentuale: number
  eps_prezzo: number
  eps_omaggiabile: boolean
}

export type CodiceSconto = {
  codice: string
  nome: string
  descrizione: string | null
  tipo: "percentuale" | "importo" | "omaggio" | "nota"
  valore: number | null
  attivo: boolean
}

export type CatalogoCommerciale = {
  id: string
  nome: string
  stato: "bozza" | "pubblicato" | "archiviato"
  valido_dal: string | null
  valido_al: string | null
  fonte_path: string | null
  fonte_fingerprint: string | null
  fotovoltaico: PrezzoFotovoltaico[]
  accumuli: MatriceAccumulo[]
  accessori: AccessorioCommerciale[]
  sconti: RegolaSconto[]
  codici_sconto: CodiceSconto[]
  note: string | null
  pubblicato_at: string | null
  aggiornato_at: string
}

export type OffertaPeriodo = {
  id: string
  titolo: string
  descrizione: string | null
  pdf_path: string | null
  cover_path: string | null
  valido_dal: string | null
  valido_al: string | null
  pubblicata: boolean
  ordinamento: number
  configurazioni: { kwp?: number; kwh?: number; prezzo?: number; label?: string }[]
  aggiornato_at: string
}

export type DocumentoCommerciale = {
  id: string
  path: string
  nome: string
  tipo: "listino" | "locandina" | "copertina" | "altro"
  fingerprint: string | null
  dimensione_kb: number | null
  modificato_at: string | null
  sincronizzato_at: string
}

export type OffertaCommercialePayload = {
  catalogo: CatalogoCommerciale | null
  offerte: OffertaPeriodo[]
  documenti: DocumentoCommerciale[]
  canManage: boolean
  nextcloudRoot: string
  versioni: Pick<CatalogoCommerciale, "id" | "nome" | "stato" | "valido_dal" | "valido_al" | "aggiornato_at">[]
}
