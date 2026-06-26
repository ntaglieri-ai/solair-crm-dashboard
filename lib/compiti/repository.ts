// ============================================================
// COMPITI — repository.ts
// Pattern identico a Lead — sostituire mock con Supabase
// ============================================================

export type Compito = {
  id: string;
  titolo: string;
  descrizione: string | null;
  stato: "da_fare" | "in_corso" | "completato" | "annullato";
  priorita: "Alta" | "Media" | "Bassa";
  scadenza: string | null;
  proprietario_id: string | null;
  proprietario_nome: string | null;
  lead_id: string | null;
  cliente_id: string | null;
  lead_nome: string | null;
  cliente_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type CompitiFilters = {
  search?: string;
  stato?: string;
  priorita?: string;
  proprietario_id?: string;
  lead_id?: string;
  cliente_id?: string;
  scadenza_da?: string;
  scadenza_a?: string;
};

export type CompitiSort = {
  field: keyof Compito;
  direction: "asc" | "desc";
};

export type CompitiPage = {
  data: Compito[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CompitiAggregations = {
  totale: number;
  da_fare: number;
  in_corso: number;
  completati: number;
  scaduti: number;
};

// ============================================================
// MOCK DATA
// ============================================================

const MOCK_COMPITI: Compito[] = [
  {
    id: "cmp_001",
    titolo: "Chiamata follow-up Mario Bianchi",
    descrizione: "Verificare disponibilità per sopralluogo",
    stato: "da_fare",
    priorita: "Alta",
    scadenza: "2026-06-27T10:00:00Z",
    proprietario_id: "usr_002",
    proprietario_nome: "Gaetano Grasso",
    lead_id: "lead_042",
    cliente_id: null,
    lead_nome: "Mario Bianchi",
    cliente_nome: null,
    created_at: "2026-06-24T09:00:00Z",
    updated_at: "2026-06-24T09:00:00Z",
  },
  {
    id: "cmp_002",
    titolo: "Inviare preventivo Lucia Rossi",
    descrizione: "Preventivo impianto 4kW con batteria",
    stato: "in_corso",
    priorita: "Alta",
    scadenza: "2026-06-26T18:00:00Z",
    proprietario_id: "usr_003",
    proprietario_nome: "Mariarosa De Leo",
    lead_id: null,
    cliente_id: "cli_002",
    lead_nome: null,
    cliente_nome: "Lucia Rossi",
    created_at: "2026-06-23T14:00:00Z",
    updated_at: "2026-06-25T10:00:00Z",
  },
  {
    id: "cmp_003",
    titolo: "Sopralluogo Antonio Ferrara",
    descrizione: "Valutazione tetto per installazione 6kW",
    stato: "completato",
    priorita: "Media",
    scadenza: "2026-06-20T09:00:00Z",
    proprietario_id: "usr_004",
    proprietario_nome: "Ivan Lo Faro",
    lead_id: null,
    cliente_id: "cli_003",
    lead_nome: null,
    cliente_nome: "Antonio Ferrara",
    created_at: "2026-06-15T08:00:00Z",
    updated_at: "2026-06-20T16:00:00Z",
  },
  {
    id: "cmp_004",
    titolo: "Conferma appuntamento Giovanna Verdi",
    descrizione: null,
    stato: "da_fare",
    priorita: "Bassa",
    scadenza: "2026-06-30T12:00:00Z",
    proprietario_id: "usr_008",
    proprietario_nome: "Gianluca Silvestro",
    lead_id: null,
    cliente_id: "cli_004",
    lead_nome: null,
    cliente_nome: "Giovanna Verdi",
    created_at: "2026-06-22T11:00:00Z",
    updated_at: "2026-06-22T11:00:00Z",
  },
  {
    id: "cmp_005",
    titolo: "Aggiornare CRM con dati firma",
    descrizione: "Caricare contratto firmato e aggiornare stato lead",
    stato: "da_fare",
    priorita: "Media",
    scadenza: "2026-06-28T17:00:00Z",
    proprietario_id: "usr_002",
    proprietario_nome: "Gaetano Grasso",
    lead_id: "lead_038",
    cliente_id: null,
    lead_nome: "Paolo Conti",
    cliente_nome: null,
    created_at: "2026-06-25T08:00:00Z",
    updated_at: "2026-06-25T08:00:00Z",
  },
];

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

function applyFilters(compiti: Compito[], filters: CompitiFilters): Compito[] {
  const now = new Date();
  return compiti.filter((c) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        c.titolo.toLowerCase().includes(q) ||
        c.descrizione?.toLowerCase().includes(q) ||
        c.lead_nome?.toLowerCase().includes(q) ||
        c.cliente_nome?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.stato && c.stato !== filters.stato) return false;
    if (filters.priorita && c.priorita !== filters.priorita) return false;
    if (filters.proprietario_id && c.proprietario_id !== filters.proprietario_id) return false;
    if (filters.lead_id && c.lead_id !== filters.lead_id) return false;
    if (filters.cliente_id && c.cliente_id !== filters.cliente_id) return false;
    if (filters.scadenza_da && c.scadenza && new Date(c.scadenza) < new Date(filters.scadenza_da)) return false;
    if (filters.scadenza_a && c.scadenza && new Date(c.scadenza) > new Date(filters.scadenza_a)) return false;
    return true;
  });
}

function applySort(compiti: Compito[], sort: CompitiSort): Compito[] {
  return [...compiti].sort((a, b) => {
    const aVal = a[sort.field] ?? "";
    const bVal = b[sort.field] ?? "";
    const cmp = String(aVal).localeCompare(String(bVal), "it");
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

// ============================================================
// QUERY PRINCIPALE — da sostituire con Supabase
// ============================================================

export async function getCompiti(params: {
  page?: number;
  pageSize?: number;
  filters?: CompitiFilters;
  sort?: CompitiSort;
}): Promise<CompitiPage> {
  const { page = 1, pageSize = 20, filters = {}, sort = { field: "scadenza", direction: "asc" } } = params;

  // TODO: sostituire con query Supabase
  // const { data, count } = await supabase
  //   .from("compiti")
  //   .select("id, titolo, stato, priorita, scadenza, proprietario_id, proprietario_nome, lead_id, cliente_id, lead_nome, cliente_nome", { count: "exact" })
  //   .order(sort.field, { ascending: sort.direction === "asc" })
  //   .range((page - 1) * pageSize, page * pageSize - 1);

  let result = [...MOCK_COMPITI];
  result = applyFilters(result, filters);
  result = applySort(result, sort);

  const total = result.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = result.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getCompitoById(id: string): Promise<Compito | null> {
  return MOCK_COMPITI.find((c) => c.id === id) ?? null;
}

export async function getCompitiAggregations(filters: CompitiFilters = {}): Promise<CompitiAggregations> {
  // TODO: sostituire con query aggregata Supabase
  const now = new Date();
  const filtered = applyFilters(MOCK_COMPITI, filters);
  return {
    totale: filtered.length,
    da_fare: filtered.filter((c) => c.stato === "da_fare").length,
    in_corso: filtered.filter((c) => c.stato === "in_corso").length,
    completati: filtered.filter((c) => c.stato === "completato").length,
    scaduti: filtered.filter((c) =>
      c.stato !== "completato" && c.stato !== "annullato" &&
      c.scadenza != null && new Date(c.scadenza) < now
    ).length,
  };
}
