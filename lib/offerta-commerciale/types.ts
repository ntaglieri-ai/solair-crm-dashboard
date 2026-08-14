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
  // true: la percentuale del codice si somma allo sconto di zona.
  // false (default): lo sostituisce. Vedi calcola-preventivo.ts.
  cumulabile_con_sconto_zona: boolean
}

export type PannelloSpec = {
  brand: string
  modello: string
  nome_display: string
  codice: string | null
  potenza_wp: number | null
  larghezza_mm: number | null
  altezza_mm: number | null
  peso_kg: number | null
  efficienza_pct: number | null
  // Numero (%/anno) o testo libero: i pannelli inseriti a mano usano entrambe
  // le forme e il configuratore pubblico legge il valore cosi com'e.
  degrado: string | number | null
  garanzia_prodotto_anni: number | null
  garanzia_lineare_anni: number | null
  tags: string[]
  tier: string | null
  attivo: boolean
  immagine_nc_path: string | null
  scheda_pdf_nc_path: string | null
  // Chiavi extra dei record creati via SQL manuale: preservate dal normalizer.
  [key: string]: unknown
}

export type SpecificheProdotto = {
  pannelli?: PannelloSpec[]
  [key: string]: unknown
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
  specifiche_prodotto: SpecificheProdotto | null
  note: string | null
  pubblicato_at: string | null
  aggiornato_at: string
}

export type OffertaPeriodo = {
  id: string
  titolo: string
  descrizione: string | null
  testo_estratto: string | null
  testo_fingerprint: string | null
  testo_estratto_at: string | null
  tipo: "offerta" | "locandina" | "brochure" | "finanziaria" | "pagina"
  url_pubblico: string | null
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

export type VersioneCatalogoCommerciale = Pick<
  CatalogoCommerciale,
  "id" | "nome" | "stato" | "valido_dal" | "valido_al" | "fonte_path" | "fonte_fingerprint" | "pubblicato_at" | "aggiornato_at"
>

export type OffertaCommercialePayload = {
  catalogo: CatalogoCommerciale | null
  offerte: OffertaPeriodo[]
  documenti: DocumentoCommerciale[]
  canManage: boolean
  nextcloudRoot: string
  versioni: VersioneCatalogoCommerciale[]
}
