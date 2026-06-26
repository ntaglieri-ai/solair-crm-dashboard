// ============================================================
// SCADENZE — repository.ts
// Pattern identico a Lead — sostituire mock con Supabase
// ============================================================

export type Scadenza = {
  id: string;
  titolo: string;
  descrizione: string | null;
  tipo: "manutenzione" | "garanzia" | "collaudo" | "permesso" | "pagamento" | "altro";
  stato: "aperta" | "completata" | "scaduta" | "annullata";
  data_scadenza: string;
  data_completamento: string | null;
  proprietario_id: string | null;
  proprietario_nome: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  installatore_id: string | null;
  installatore_nome: string | null;
  importo: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ScadenzeFilters = {
  search?: string;
  stato?: string;
  tipo?: string;
  proprietario_id?: string;
  cliente_id?: string;
  data_da?: string;
  data_a?: string;
  scadute_only?: boolean;
};

export type ScadenzeSort = {
  field: keyof Scadenza;
  direction: "asc" | "desc";
};

export type ScadenzePage = {
  data: Scadenza[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ScadenzeAggregations = {
  totale: number;
  aperte: number;
  completate: number;
  scadute: number;
  in_scadenza_7gg: number;
};

// ============================================================
// MOCK DATA
// ============================================================

const MOCK_SCADENZE: Scadenza[] = [
  {
    id: "scd_001",
    titolo: "Manutenzione annuale — Bianchi Mario",
    descrizione: "Pulizia pannelli e verifica impianto",
    tipo: "manutenzione",
    stato: "aperta",
    data_scadenza: "2026-07-15T08:00:00Z",
    data_completamento: null,
    proprietario_id: "usr_002",
    proprietario_nome: "Gaetano Grasso",
    cliente_id: "cli_001",
    cliente_nome: "Mario Bianchi",
    installatore_id: "ins_001",
    installatore_nome: "Carlo Mancuso",
    importo: 150,
    note: null,
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-06-01T08:00:00Z",
  },
  {
    id: "scd_002",
    titolo: "Collaudo impianto — Ferrara Antonio",
    descrizione: "Collaudo GSE impianto 6kW",
    tipo: "collaudo",
    stato: "aperta",
    data_scadenza: "2026-06-30T09:00:00Z",
    data_completamento: null,
    proprietario_id: "usr_004",
    proprietario_nome: "Ivan Lo Faro",
    cliente_id: "cli_003",
    cliente_nome: "Antonio Ferrara",
    installatore_id: "ins_002",
    installatore_nome: "Salvatore Rizzo",
    importo: null,
    note: "Documentazione GSE da preparare",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-10T10:00:00Z",
  },
  {
    id: "scd_003",
    titolo: "Garanzia pannelli — Rossi Lucia",
    descrizione: "Scadenza garanzia prodotto 10 anni",
    tipo: "garanzia",
    stato: "aperta",
    data_scadenza: "2036-02-10T00:00:00Z",
    data_completamento: null,
    proprietario_id: "usr_003",
    proprietario_nome: "Mariarosa De Leo",
    cliente_id: "cli_002",
    cliente_nome: "Lucia Rossi",
    installatore_id: null,
    installatore_nome: null,
    importo: null,
    note: null,
    created_at: "2026-02-10T09:00:00Z",
    updated_at: "2026-02-10T09:00:00Z",
  },
  {
    id: "scd_004",
    titolo: "Pagamento saldo — Ferrara Antonio",
    descrizione: "Saldo contratto installazione",
    tipo: "pagamento",
    stato: "completata",
    data_scadenza: "2026-06-15T00:00:00Z",
    data_completamento: "2026-06-14T10:00:00Z",
    proprietario_id: "usr_004",
    proprietario_nome: "Ivan Lo Faro",
    cliente_id: "cli_003",
    cliente_nome: "Antonio Ferrara",
    installatore_id: null,
    installatore_nome: null,
    importo: 3200,
    note: "Pagato tramite bonifico",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-06-14T10:00:00Z",
  },
  {
    id: "scd_005",
    titolo: "Permesso SUAP — Verdi Giovanna",
    descrizione: "Pratica permesso edilizio comune Torino",
    tipo: "permesso",
    stato: "scaduta",
    data_scadenza: "2026-06-10T00:00:00Z",
    data_completamento: null,
    proprietario_id: "usr_008",
    proprietario_nome: "Gianluca Silvestro",
    cliente_id: "cli_004",
    cliente_nome: "Giovanna Verdi",
    installatore_id: null,
    installatore_nome: null,
    importo: null,
    note: "Da rinnovare — contattare comune",
    created_at: "2026-05-15T09:00:00Z",
    updated_at: "2026-06-11T08:00:00Z",
  },
];

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

function applyFilters(scadenze: Scadenza[], filters: ScadenzeFilters): Scadenza[] {
  const now = new Date();
  const sette_gg = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return scadenze.filter((s) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        s.titolo.toLowerCase().includes(q) ||
        s.descrizione?.toLowerCase().includes(q) ||
        s.cliente_nome?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.stato && s.stato !== filters.stato) return false;
    if (filters.tipo && s.tipo !== filters.tipo) return false;
    if (filters.proprietario_id && s.proprietario_id !== filters.proprietario_id) return false;
    if (filters.cliente_id && s.cliente_id !== filters.cliente_id) return false;
    if (filters.data_da && new Date(s.data_scadenza) < new Date(filters.data_da)) return false;
    if (filters.data_a && new Date(s.data_scadenza) > new Date(filters.data_a)) return false;
    if (filters.scadute_only && new Date(s.data_scadenza) >= now) return false;
    return true;
  });
}

function applySort(scadenze: Scadenza[], sort: ScadenzeSort): Scadenza[] {
  return [...scadenze].sort((a, b) => {
    const aVal = a[sort.field] ?? "";
    const bVal = b[sort.field] ?? "";
    const cmp = String(aVal).localeCompare(String(bVal), "it");
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

// ============================================================
// QUERY PRINCIPALE — da sostituire con Supabase
// ============================================================

export async function getScadenze(params: {
  page?: number;
  pageSize?: number;
  filters?: ScadenzeFilters;
  sort?: ScadenzeSort;
}): Promise<ScadenzePage> {
  const { page = 1, pageSize = 20, filters = {}, sort = { field: "data_scadenza", direction: "asc" } } = params;

  // TODO: sostituire con query Supabase
  // const { data, count } = await supabase
  //   .from("scadenze")
  //   .select("id, titolo, tipo, stato, data_scadenza, proprietario_id, proprietario_nome, cliente_id, cliente_nome, importo", { count: "exact" })
  //   .order(sort.field, { ascending: sort.direction === "asc" })
  //   .range((page - 1) * pageSize, page * pageSize - 1);

  let result = [...MOCK_SCADENZE];
  result = applyFilters(result, filters);
  result = applySort(result, sort);

  const total = result.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = result.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getScadenzaById(id: string): Promise<Scadenza | null> {
  return MOCK_SCADENZE.find((s) => s.id === id) ?? null;
}

export async function getScadenzeAggregations(filters: ScadenzeFilters = {}): Promise<ScadenzeAggregations> {
  // TODO: sostituire con query aggregata Supabase
  const now = new Date();
  const sette_gg = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const filtered = applyFilters(MOCK_SCADENZE, filters);

  return {
    totale: filtered.length,
    aperte: filtered.filter((s) => s.stato === "aperta").length,
    completate: filtered.filter((s) => s.stato === "completata").length,
    scadute: filtered.filter((s) => s.stato === "scaduta" || (s.stato === "aperta" && new Date(s.data_scadenza) < now)).length,
    in_scadenza_7gg: filtered.filter((s) =>
      s.stato === "aperta" &&
      new Date(s.data_scadenza) >= now &&
      new Date(s.data_scadenza) <= sette_gg
    ).length,
  };
}
