// ============================================================
// CLIENTI — repository.ts
// Pattern identico a Lead — sostituire mock con Supabase
// ============================================================

export type Cliente = {
  id: string;
  ragione_sociale: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  provincia: string | null;
  cap: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  proprietario_id: string | null;
  proprietario_nome: string | null;
  lead_id: string | null; // lead di origine
  stato: "attivo" | "inattivo" | "prospect";
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientiFilters = {
  search?: string;
  stato?: string;
  proprietario_id?: string;
  citta?: string;
};

export type ClientiSort = {
  field: keyof Cliente;
  direction: "asc" | "desc";
};

export type ClientiPage = {
  data: Cliente[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ClientiAggregations = {
  totale: number;
  attivi: number;
  inattivi: number;
  prospect: number;
};

// ============================================================
// MOCK DATA
// ============================================================

const MOCK_CLIENTI: Cliente[] = [
  {
    id: "cli_001",
    ragione_sociale: "Mario Bianchi",
    email: "mario.bianchi@email.it",
    telefono: "+39 333 1234567",
    indirizzo: "Via Roma 1",
    citta: "Catania",
    provincia: "CT",
    cap: "95100",
    partita_iva: null,
    codice_fiscale: "BNCMRA80A01C351A",
    proprietario_id: "usr_002",
    proprietario_nome: "Gaetano Grasso",
    lead_id: "lead_042",
    stato: "attivo",
    note: "Cliente acquisito da Meta Ads",
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-06-20T14:00:00Z",
  },
  {
    id: "cli_002",
    ragione_sociale: "Lucia Rossi",
    email: "lucia.rossi@email.it",
    telefono: "+39 347 9876543",
    indirizzo: "Corso Italia 22",
    citta: "Treviso",
    provincia: "TV",
    cap: "31100",
    partita_iva: null,
    codice_fiscale: "RSSLCU75B41L736A",
    proprietario_id: "usr_003",
    proprietario_nome: "Mariarosa De Leo",
    lead_id: "lead_039",
    stato: "attivo",
    note: null,
    created_at: "2026-02-10T09:00:00Z",
    updated_at: "2026-06-18T11:00:00Z",
  },
  {
    id: "cli_003",
    ragione_sociale: "Antonio Ferrara",
    email: "antonio.ferrara@impresa.it",
    telefono: "+39 320 5554433",
    indirizzo: "Via Etnea 88",
    citta: "Catania",
    provincia: "CT",
    cap: "95125",
    partita_iva: "04521890871",
    codice_fiscale: null,
    proprietario_id: "usr_004",
    proprietario_nome: "Ivan Lo Faro",
    lead_id: "lead_037",
    stato: "attivo",
    note: "Installazione 6kW completata",
    created_at: "2026-03-05T08:30:00Z",
    updated_at: "2026-06-15T16:00:00Z",
  },
  {
    id: "cli_004",
    ragione_sociale: "Giovanna Verdi",
    email: "g.verdi@email.it",
    telefono: "+39 389 2223344",
    indirizzo: "Via Po 5",
    citta: "Torino",
    provincia: "TO",
    cap: "10100",
    partita_iva: null,
    codice_fiscale: "VRDGNN68C41L219A",
    proprietario_id: "usr_008",
    proprietario_nome: "Gianluca Silvestro",
    lead_id: "lead_031",
    stato: "prospect",
    note: "In attesa di sopralluogo",
    created_at: "2026-04-20T10:00:00Z",
    updated_at: "2026-06-10T09:00:00Z",
  },
  {
    id: "cli_005",
    ragione_sociale: "Marco Neri",
    email: null,
    telefono: "+39 333 6667788",
    indirizzo: "Via Garibaldi 14",
    citta: "Treviso",
    provincia: "TV",
    cap: "31100",
    partita_iva: null,
    codice_fiscale: "NREMRC55D10L736B",
    proprietario_id: "usr_005",
    proprietario_nome: "Fabio Tizi",
    lead_id: null,
    stato: "inattivo",
    note: "Contratto annullato",
    created_at: "2025-11-01T12:00:00Z",
    updated_at: "2026-01-10T08:00:00Z",
  },
];

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

function applyFilters(clienti: Cliente[], filters: ClientiFilters): Cliente[] {
  return clienti.filter((c) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        c.ragione_sociale.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefono?.includes(q) ||
        c.citta?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.stato && c.stato !== filters.stato) return false;
    if (filters.proprietario_id && c.proprietario_id !== filters.proprietario_id) return false;
    if (filters.citta && c.citta?.toLowerCase() !== filters.citta.toLowerCase()) return false;
    return true;
  });
}

function applySort(clienti: Cliente[], sort: ClientiSort): Cliente[] {
  return [...clienti].sort((a, b) => {
    const aVal = a[sort.field] ?? "";
    const bVal = b[sort.field] ?? "";
    const cmp = String(aVal).localeCompare(String(bVal), "it");
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

// Proiezione selettiva — evita di trasportare campi pesanti inutili
function project<K extends keyof Cliente>(
  clienti: Cliente[],
  fields: K[]
): Pick<Cliente, K>[] {
  return clienti.map((c) => {
    const out = {} as Pick<Cliente, K>;
    fields.forEach((f) => (out[f] = c[f]));
    return out;
  });
}

// ============================================================
// QUERY PRINCIPALE — da sostituire con Supabase
// ============================================================

export async function getClienti(params: {
  page?: number;
  pageSize?: number;
  filters?: ClientiFilters;
  sort?: ClientiSort;
}): Promise<ClientiPage> {
  const { page = 1, pageSize = 20, filters = {}, sort = { field: "ragione_sociale", direction: "asc" } } = params;

  // TODO: sostituire con query Supabase
  // const { data, count } = await supabase
  //   .from("clienti")
  //   .select("id, ragione_sociale, email, telefono, citta, stato, proprietario_id, proprietario_nome, created_at", { count: "exact" })
  //   .ilike("ragione_sociale", `%${filters.search}%`)
  //   .eq("stato", filters.stato)
  //   .order(sort.field, { ascending: sort.direction === "asc" })
  //   .range((page - 1) * pageSize, page * pageSize - 1);

  let result = [...MOCK_CLIENTI];
  result = applyFilters(result, filters);
  result = applySort(result, sort);

  const total = result.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = result.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  // TODO: sostituire con Supabase
  return MOCK_CLIENTI.find((c) => c.id === id) ?? null;
}

export async function getClientiAggregations(filters: ClientiFilters = {}): Promise<ClientiAggregations> {
  // TODO: sostituire con query aggregata Supabase
  const filtered = applyFilters(MOCK_CLIENTI, filters);
  return {
    totale: filtered.length,
    attivi: filtered.filter((c) => c.stato === "attivo").length,
    inattivi: filtered.filter((c) => c.stato === "inattivo").length,
    prospect: filtered.filter((c) => c.stato === "prospect").length,
  };
}
