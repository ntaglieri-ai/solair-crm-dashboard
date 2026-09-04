"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Upload,
  Download,
  SlidersHorizontal,
} from "lucide-react"
import { IconSettings } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LEAD_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  type Lead,
  type LeadColumnId,
} from "@/lib/mock-data"
import {
  LeadSearchInput,
  DEFAULT_FILTERS,
  type LeadFilterState,
} from "@/components/leads/lead-filters"
import {
  LeadTable,
  type SortDir,
  type Density,
} from "@/components/leads/lead-table"
import { BulkToolbar } from "@/components/leads/bulk-toolbar"
import { BulkEmailDialog } from "@/components/shared/bulk-email-dialog"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import {
  LeadSettingsSheet,
  type SettingsSectionId,
} from "@/components/leads/lead-settings-sheet"
import { LeadActionsMenu } from "@/components/leads/lead-actions-menu"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"
import {
  ExportTruncatoDialog,
  type ExportTruncatoInfo,
} from "@/components/shared/export-truncato-dialog"
import {
  AdvancedFilters,
  EMPTY_ADVANCED,
  type AdvancedFilterState,
} from "@/components/leads/advanced-filters"
import {
  type LeadListParams,
  type LeadListItem,
  type LeadListResponse,
  type LeadStats,
  INITIAL_PAGE_SIZE,
} from "@/lib/leads/api-types"
import {
  useLeadsQuery,
  useLeadStats,
  useCreateLead,
  useDeleteLead,
  useUpdateLead,
  useConvertLead,
  useBulkLeads,
  fetchLeadsForExport,
  fetchLeadsByIdsForExport,
  type LeadExportResult,
} from "@/lib/leads/hooks"
import { useTags } from "@/lib/tag-store"
import { usePermissions } from "@/lib/permissions/provider"
import { useQueryClient } from "@tanstack/react-query"
import {
  LEADS_VIEW_COOKIE,
  LEADS_VIEW_COOKIE_PATH,
  serializeLeadViewPreferences,
  type LeadViewPreferences,
} from "@/lib/leads/view-preferences"
import { normalizeLeadColumnWidths } from "@/lib/leads/column-widths"
import { leadsKeys } from "@/lib/leads/hooks"
import { useIsMobile } from "@/hooks/use-is-mobile"

type StoredLeadPreferences = {
  visibleCols: LeadColumnId[]
  columnWidths: Partial<Record<LeadColumnId, number>>
  density: Density
}

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "20": "20 righe",
  "30": "30 righe",
  "50": "50 righe",
}

/** Viste rapide del drawer Filtri (Tutti/Da contattare/…). */
const QUICK_VIEWS: { label: string; stato: string; commerciale: string }[] = [
  { label: "Tutti", stato: "all", commerciale: "all" },
  { label: "Da contattare", stato: "Non contattato", commerciale: "all" },
  { label: "Da richiamare", stato: "Tentato di contattare", commerciale: "all" },
  { label: "Non assegnati", stato: "all", commerciale: "__unassigned__" },
]

// Simula il download di un file CSV a partire dalle righe passate
function downloadLeadsCsv(rows: LeadListItem[], filename: string) {
  const cols = LEAD_COLUMNS.map((c) => c.id)
  const header = cols.join(";")
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = (r as Record<string, unknown>)[c]
          const s = Array.isArray(v) ? v.join(", ") : String(v ?? "")
          return `"${s.replace(/"/g, '""')}"`
        })
        .join(";"),
    )
    .join("\n")
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface LeadsClientProps {
  /** Query-string del prefetch server-side (per abbinare la chiave React Query). */
  initialSp: string
  /** Prima pagina pre-caricata; null quando la route lascia lavorare la cache client. */
  initialLeads: LeadListResponse | null
  /** Statistiche header pre-caricate; null quando arrivano dalla cache client. */
  initialStats: LeadStats | null
  /**
   * Preferenze di vista lette dal cookie lato server. Quando ci sono, il primo
   * render (server e client) usa già le colonne dell'utente: senza, la tabella
   * si disegnava con i default e saltava alla configurazione salvata solo a
   * idratazione finita.
   */
  initialPreferences: StoredLeadPreferences | null
}

export function LeadsClient({
  initialSp,
  initialLeads,
  initialStats,
  initialPreferences,
}: LeadsClientProps) {
  const { tags, hydrateLeadTagIds } = useTags()
  const permissions = usePermissions()
  const allTags = useMemo(() => tags.map((tag) => tag.name), [tags])
  const preferenceOwner =
    permissions.snapshot.subject.userId ??
    permissions.snapshot.subject.authUserId ??
    "anonymous"
  const preferenceKey = `solair:leads:view:${preferenceOwner}:v3`
  const queryClient = useQueryClient()
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilterState>(DEFAULT_FILTERS)
  const [advanced, setAdvanced] = useState<AdvancedFilterState>(EMPTY_ADVANCED)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Export troncato: l'avviso e il download che parte solo dopo conferma.
  const [exportTruncato, setExportTruncato] = useState<ExportTruncatoInfo | null>(null)
  const pendingExport = useRef<(() => void) | null>(null)
  const [rowsPerPage, setRowsPerPage] = useState(INITIAL_PAGE_SIZE)
  const isMobile = useIsMobile()
  // Su mobile una pagina da 20 lead scrolla molto meno di una da 50: applichiamo
  // il default più contenuto solo finché l'utente non ha scelto altro lui stesso.
  const mobileDefaultApplied = useRef(false)
  useEffect(() => {
    if (isMobile && !mobileDefaultApplied.current && rowsPerPage === INITIAL_PAGE_SIZE) {
      mobileDefaultApplied.current = true
      setRowsPerPage(20)
    }
  }, [isMobile, rowsPerPage])
  // Blocca lo scroll della pagina (body/html) su mobile mentre questa vista è
  // montata: il glitch visto in produzione era il classico "doppio scroll" di
  // Safari iOS — pagina esterna e lista interna scrollabili insieme, il dito
  // a volte muove quella sbagliata creando lo strappo tra header e lista.
  // Con l'esterno bloccato resta scrollabile solo la lista lead.
  useEffect(() => {
    if (!isMobile) return
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevBodyOverscroll = document.body.style.overscrollBehavior
    html.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    document.body.style.overscrollBehavior = "none"
    return () => {
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [isMobile])
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null)
  const [visibleCols, setVisibleCols] = useState<LeadColumnId[]>(
    initialPreferences?.visibleCols ?? DEFAULT_VISIBLE_COLUMNS,
  )
  const [columnWidths, setColumnWidths] = useState<
    Partial<Record<LeadColumnId, number>>
  >(initialPreferences?.columnWidths ?? {})
  // Con le preferenze dal cookie non c'è nulla da caricare: lo stato è già
  // quello definitivo fin dal primo render.
  const [preferencesLoaded, setPreferencesLoaded] = useState(
    initialPreferences != null,
  )
  const [sortBy, setSortBy] = useState<LeadColumnId | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [density, setDensity] = useState<Density>(
    initialPreferences?.density ?? "normale",
  )
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>("generali")

  const columns = useMemo(
    () =>
      visibleCols
        .map((id) => LEAD_COLUMNS.find((column) => column.id === id))
        .filter((column): column is (typeof LEAD_COLUMNS)[number] => Boolean(column)),
    [visibleCols],
  )

  // Migrazione una tantum: chi ha ancora le preferenze solo in localStorage le
  // vede applicate qui (un salto, l'ultimo), poi l'effetto di salvataggio qui
  // sotto scrive il cookie e dal caricamento successivo il server disegna
  // subito la vista giusta. Con il cookie già presente questo effetto non fa
  // nulla: il cookie è la fonte autorevole.
  useEffect(() => {
    if (initialPreferences) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const raw = window.localStorage.getItem(preferenceKey)
        if (raw) {
          const stored = JSON.parse(raw) as Partial<LeadViewPreferences>
          const validIds = new Set(LEAD_COLUMNS.map((column) => column.id))
          const order = (stored.visibleCols ?? []).filter((id) => validIds.has(id))
          if (order.length) setVisibleCols(order)
          setColumnWidths(normalizeLeadColumnWidths(stored.columnWidths, validIds))
          if (
            stored.density === "comoda" ||
            stored.density === "normale" ||
            stored.density === "densa"
          ) {
            setDensity(stored.density)
          }
        }
      } catch {
        window.localStorage.removeItem(preferenceKey)
      } finally {
        setPreferencesLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [initialPreferences, preferenceKey])

  useEffect(() => {
    if (!preferencesLoaded) return
    const preferences: LeadViewPreferences = {
      version: 3,
      owner: preferenceOwner,
      visibleCols,
      columnWidths,
      density,
    }
    window.localStorage.setItem(preferenceKey, JSON.stringify(preferences))

    // Stessa cosa nel cookie, che è ciò che il server legge al prossimo
    // caricamento. Path=/leads per non spedirlo con ogni asset; un anno di
    // durata, come una preferenza di interfaccia; SameSite=Lax perché non
    // serve a niente in cross-site e Secure fuori da localhost.
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie =
      `${LEADS_VIEW_COOKIE}=${serializeLeadViewPreferences(preferences)}` +
      `; Path=${LEADS_VIEW_COOKIE_PATH}; Max-Age=31536000; SameSite=Lax${secure}`
  }, [
    columnWidths,
    density,
    preferenceKey,
    preferenceOwner,
    preferencesLoaded,
    visibleCols,
  ])

  const reorderColumns = useCallback(
    (source: LeadColumnId, target: LeadColumnId) => {
      setVisibleCols((current) => {
        const from = current.indexOf(source)
        const to = current.indexOf(target)
        if (from < 0 || to < 0 || from === to) return current
        const next = [...current]
        next.splice(to, 0, next.splice(from, 1)[0])
        return next
      })
    },
    [],
  )

  // Ricerca con debounce: l'input resta reattivo (filters.search), ma la query
  // parte solo ~350ms dopo l'ultimo tasto, evitando un fetch a ogni carattere.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  useEffect(() => {
    if (debouncedSearch === filters.search) return
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [filters.search, debouncedSearch])

  // Parametri di query inviati al server (paginazione/filtri/ordinamento/proiezione).
  // Memoizzati: evitano di ricreare l'oggetto (e nuove fetch) a ogni render.
  const params: LeadListParams = useMemo(
    () => ({
      page,
      pageSize: rowsPerPage,
      sortBy,
      sortDir,
      search: debouncedSearch,
      stato: filters.stato,
      sede: filters.sede,
      commerciale: filters.commerciale,
      origine: filters.origine,
      tag: filters.tag,
      score: filters.score,
      onlyDuplicates,
      advanced,
      fields: visibleCols as unknown as string[],
    }),
    [
      page,
      rowsPerPage,
      sortBy,
      sortDir,
      debouncedSearch,
      filters.stato,
      filters.sede,
      filters.commerciale,
      filters.origine,
      filters.tag,
      filters.score,
      onlyDuplicates,
      advanced,
      visibleCols,
    ],
  )

  const { data, isFetching, isError } = useLeadsQuery(
    params,
    initialLeads
      ? {
          sp: initialSp,
          data: initialLeads,
        }
      : undefined,
  )
  const { data: stats } = useLeadStats(initialStats ?? undefined)

  const createLead = useCreateLead()
  const deleteLead = useDeleteLead()
  const updateLead = useUpdateLead()
  const convertLead = useConvertLead()
  const bulk = useBulkLeads()

  // Le righe sono proiezioni selettive; la tabella usa solo i campi inclusi.
  const pageRows = useMemo(
    () => (data?.rows ?? []) as Lead[],
    [data?.rows],
  )
  useEffect(() => {
    const assignments = Object.fromEntries(
      pageRows.map((lead) => [lead.id, lead.tagIds ?? []]),
    )
    hydrateLeadTagIds(assignments)
  }, [hydrateLeadTagIds, pageRows])
  const total = data?.total ?? 0
  const headerTotal = stats?.total ?? data?.total

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const start = (page - 1) * rowsPerPage
  const rangeStart = total === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, total)

  // --- Altezza dinamica della pagina (footer sempre visibile) ---
  // La topbar ha altezza variabile (responsive/breakpoint), quindi un calc fisso
  // non basta. Misuriamo l'offset reale del contenitore dalla cima del viewport e
  // blocchiamo l'altezza fino al fondo schermo: il footer resta sempre in vista e
  // la tabella scrolla internamente, su qualsiasi dimensione di schermo.
  const rootRef = useRef<HTMLDivElement>(null)
  const [availH, setAvailH] = useState<number | null>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Padding inferiore del <main> (py-6 = 24px), costante a ogni breakpoint.
    const BOTTOM_GAP = 24
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      const next = Math.max(360, window.innerHeight - top - BOTTOM_GAP)
      setAvailH(next)
    }
    measure()
    window.addEventListener("resize", measure)
    // La topbar può cambiare altezza (stacking responsive): osserva il body.
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => {
      window.removeEventListener("resize", measure)
      ro.disconnect()
    }
  }, [])

  const handleFilterChange = useCallback((next: LeadFilterState) => {
    setFilters(next)
    setPage(1)
  }, [])

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setAdvanced(EMPTY_ADVANCED)
    setOnlyDuplicates(false)
    setPage(1)
  }, [])

  const handleAdvancedApply = useCallback((next: AdvancedFilterState) => {
    setAdvanced(next)
    setPage(1)
  }, [])

  // Crea un nuovo lead via API e torna alla prima pagina — SOLO se la
  // creazione riesce davvero. Prima i filtri/pagina/ordinamento venivano
  // azzerati subito al click, indipendentemente dall'esito: se la
  // creazione falliva (es. il bug data 25/07), l'utente si ritrovava
  // comunque con la vista resettata per un errore, sembrando che "la
  // pagina si mischiasse" senza motivo.
  const handleCreateLead = (lead: Lead) => {
    createLead.mutate(lead, {
      onSuccess: () => {
        toast.success("Lead creato", {
          description: `${lead["Nome Lead"]} aggiunto al CRM.`,
        })
        setFilters(DEFAULT_FILTERS)
        setAdvanced(EMPTY_ADVANCED)
        setOnlyDuplicates(false)
        setSortBy(null)
        setPage(1)
      },
      onError: () => toast.error("Creazione non riuscita"),
    })
  }

  // Controllo duplicati: usa il conteggio aggregato dalle statistiche
  const handleCheckDuplicates = () => {
    const found = stats?.duplicati ?? 0
    if (found === 0) {
      toast.success("Nessun duplicato trovato", {
        description: "Tutti i lead risultano univoci per email e telefono.",
      })
      return
    }
    setOnlyDuplicates(true)
    setPage(1)
    toast.warning(`${found} possibili duplicati`, {
      description: "Filtro applicato: verifica e unisci i record sospetti.",
    })
  }

  const handleSort = useCallback((col: LeadColumnId) => {
    setSortBy((prevCol) => {
      if (prevCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prevCol
      }
      setSortDir("asc")
      return col
    })
    setPage(1)
  }, [])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allOnPage = pageRows.every((l) => prev.has(l.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((l) => next.delete(l.id))
      else pageRows.forEach((l) => next.add(l.id))
      return next
    })
  }, [pageRows])

  // Righe selezionate disponibili nella pagina corrente (per la toolbar)
  const selectedRows = useMemo(
    () => pageRows.filter((l) => selected.has(l.id)),
    [pageRows, selected],
  )
  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const handleBulkOwner = (owner: string) => {
    const n = selected.size
    bulk.mutate(
      { action: "transfer", ids: selectedIds, value: owner },
      {
        onSuccess: () => {
          toast.success("Proprietario aggiornato", {
            description: `${n} lead assegnati a ${owner}.`,
          })
          setSelected(new Set())
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
      },
    )
  }

  const handleBulkStato = (stato: string) => {
    const n = selected.size
    bulk.mutate(
      { action: "update", ids: selectedIds, field: "Stato Lead", value: stato },
      {
        onSuccess: () => {
          toast.success("Stato aggiornato", {
            description: `${n} lead impostati su "${stato}".`,
          })
          setSelected(new Set())
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
      },
    )
  }

  // Aggiornamento di massa generico su Stato Lead / Sede / Tag
  const handleBulkUpdate = (
    field: "Stato Lead" | "Sede" | "Tag",
    value: string,
  ) => {
    const n = selected.size
    bulk.mutate(
      { action: "update", ids: selectedIds, field, value },
      {
        onSuccess: () => {
          toast.success("Lead aggiornati", {
            description: `${field} impostato su "${value}" per ${n} lead.`,
          })
          setSelected(new Set())
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
      },
    )
  }

  const handleBulkConvert = () => {
    const n = selected.size
    bulk.mutate(
      { action: "convert", ids: selectedIds },
      {
        onSuccess: () => {
          toast.success("Lead convertiti", {
            description: `${n} lead convertiti in clienti.`,
          })
          setSelected(new Set())
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
      },
    )
  }

  const handleBulkApprove = () => {
    const n = selected.size
    toast.success("Lead approvati", { description: `${n} lead approvati.` })
    setSelected(new Set())
  }

  const handleBulkDedup = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) {
      toast.info("Nessun record rimosso")
      setSelected(new Set())
      return
    }
    bulk.mutate(
      { action: "delete", ids: idsToRemove },
      {
        onSuccess: () => {
          toast.success("Duplicati uniti", {
            description: `${idsToRemove.length} record duplicati rimossi.`,
          })
          setSelected(new Set())
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
      },
    )
  }

  // Un export che tronca in silenzio e' peggio di un export che fallisce: il
  // file sembra completo. Quindi si scarica solo se l'insieme e' intero, e
  // altrimenti si passa dal dialog che dice quante righe mancano.
  const runExport = async (
    fetcher: () => Promise<LeadExportResult>,
    filename: (n: number) => string,
  ) => {
    try {
      const result = await fetcher()
      const download = () => {
        downloadLeadsCsv(result.rows, filename(result.rows.length))
        toast.success("Esportazione avviata", {
          description: `${result.rows.length} lead esportati in CSV.`,
        })
      }
      if (result.truncated) {
        setExportTruncato({
          esportate: result.rows.length,
          totali: result.total,
          limite: result.limit,
          entita: "lead",
        })
        pendingExport.current = download
        return
      }
      download()
    } catch (error) {
      // Il messaggio del server arriva fin qui: un 403 per permesso mancante
      // dice all'utente cosa chiedere all'amministratore, un generico
      // "non riuscita" lo lascerebbe a indovinare.
      toast.error(
        error instanceof Error ? error.message : "Esportazione non riuscita",
      )
    }
  }

  const handleBulkExport = () =>
    runExport(
      () => fetchLeadsByIdsForExport(selectedIds),
      (n) => `lead-selezione-${n}.csv`,
    )

  const handleExportFiltered = () =>
    runExport(
      () => fetchLeadsForExport(params),
      (n) => `lead-filtrati-${n}.csv`,
    )

  const confirmBulkDelete = () => {
    const n = selected.size
    bulk.mutate(
      { action: "delete", ids: selectedIds },
      {
        onSuccess: () => {
          toast.success("Lead eliminati", { description: `${n} lead rimossi.` })
          setBulkDeleteOpen(false)
          setSelected(new Set())
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Eliminazione non riuscita"),
      },
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const name = deleteTarget["Nome Lead"]
    deleteLead.mutate(deleteTarget.id, {
      onSuccess: () =>
        toast.success("Lead eliminato", { description: `${name} rimosso.` }),
      onError: () => toast.error("Eliminazione non riuscita"),
    })
    setDeleteTarget(null)
  }

  const confirmConvert = () => {
    if (!convertTarget) return
    const name = convertTarget["Nome Lead"]
    convertLead.mutate(convertTarget.id, {
      onSuccess: () =>
        toast.success("Lead convertito", {
          description: `${name} convertito in cliente.`,
        }),
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Conversione non riuscita"),
    })
    setConvertTarget(null)
  }

  // Apre lo sheet impostazioni su una specifica sezione (es. da menu Azioni)
  const openSettings = (section: SettingsSectionId) => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  return (
    <div
      ref={rootRef}
      style={availH ? { height: availH } : undefined}
      className="flex h-[calc(100svh-9rem)] min-w-0 flex-col gap-2.5 lg:h-[calc(100svh-6rem)] lg:gap-4"
    >
      {/* Header pagina */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:gap-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <h1 className="break-words text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Lead
          </h1>
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground sm:text-[15px]">
            {headerTotal != null
              ? `${headerTotal.toLocaleString("it-IT")} lead disponibili`
              : "Caricamento lead..."}
            {isFetching ? (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Aggiornamento in corso"
              />
            ) : null}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-1.5 lg:flex lg:w-auto lg:flex-wrap lg:justify-end lg:gap-2">
          {/* Impostazioni lead (generali, vista colonne) */}
          <LeadSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            section={settingsSection}
            onSectionChange={setSettingsSection}
            visibleCols={visibleCols}
            onVisibleColsChange={setVisibleCols}
            density={density}
            onDensityChange={setDensity}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n)
              setPage(1)
            }}
            trigger={
              <Button
                variant="outline"
                aria-label="Impostazioni lead"
                className="h-11 w-full gap-1.5 bg-card px-2 text-xs lg:h-10 lg:w-10 lg:p-0 lg:text-sm"
              >
                <IconSettings size={22} stroke={1.8} className="lg:size-[18px]" />
                <span className="lg:hidden">Imposta</span>
              </Button>
            }
          />

          {/* Menu azioni (cambia in base alla selezione) */}
          <LeadActionsMenu
            selectedCount={selected.size}
            filtered={pageRows}
            selectedRows={selectedRows}
            tags={allTags}
            onOpenSettings={openSettings}
            onCheckDuplicates={handleCheckDuplicates}
            onImport={() => setImportOpen(true)}
            onExportFiltered={handleExportFiltered}
            onExportSelection={handleBulkExport}
            onBulkTransfer={handleBulkOwner}
            onBulkUpdate={handleBulkUpdate}
            onBulkConvert={handleBulkConvert}
            onBulkApprove={handleBulkApprove}
            onBulkDedup={handleBulkDedup}
            onBulkEmail={() => setBulkEmailOpen(true)}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <Button
            variant="outline"
            className="h-11 w-full gap-1.5 bg-card px-2 text-xs lg:h-10 lg:w-auto lg:gap-2 lg:px-3.5 lg:text-sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-[22px] lg:size-4" />
            Importa
          </Button>

          <Button
            variant="outline"
            className="h-11 w-full gap-1.5 bg-card px-2 text-xs lg:h-10 lg:w-auto lg:gap-2 lg:px-3.5 lg:text-sm"
            onClick={handleExportFiltered}
          >
            <Download className="size-[22px] lg:size-4" />
            Esporta
          </Button>

          <AdvancedFilters
            applied={advanced}
            onApply={handleAdvancedApply}
            tags={allTags}
            quickFilters={filters}
            onQuickFiltersChange={handleFilterChange}
            onQuickFiltersReset={handleReset}
            quickViews={QUICK_VIEWS.map((view) => ({
              label: view.label,
              active:
                (view.stato === "all"
                  ? filters.stato.length === 0
                  : filters.stato.length === 1 && filters.stato.includes(view.stato)) &&
                (view.commerciale === "all"
                  ? filters.commerciale.length === 0
                  : filters.commerciale.length === 1 && filters.commerciale.includes(view.commerciale)),
              onSelect: () =>
                handleFilterChange({
                  ...DEFAULT_FILTERS,
                  stato: view.stato === "all" ? [] : [view.stato],
                  commerciale: view.commerciale === "all" ? [] : [view.commerciale],
                }),
            }))}
            trigger={({ onClick, count }) => (
              <Button
                onClick={onClick}
                className="relative h-11 w-full gap-1.5 bg-primary px-2 text-xs text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 lg:h-10 lg:w-auto lg:gap-2 lg:px-3.5 lg:text-sm"
              >
                <SlidersHorizontal className="size-[22px] lg:size-4" />
                Filtri
                {count > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1 text-xs font-bold tabular-nums text-teal-foreground">
                    {count}
                  </span>
                ) : null}
              </Button>
            )}
          />

          <Button
            className="h-11 w-full gap-1.5 bg-teal px-2 text-xs text-teal-foreground hover:bg-teal/90 lg:h-10 lg:w-auto lg:gap-2 lg:px-3.5 lg:text-sm"
            onClick={() => setNewLeadOpen(true)}
          >
            <Plus className="size-[22px] lg:size-4" />
            <span className="lg:hidden">Nuovo</span>
            <span className="hidden lg:inline">Nuovo lead</span>
          </Button>
        </div>
      </div>

      {/* Indicatore filtro duplicati attivo */}
      {onlyDuplicates ? (
        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
          <span className="text-sm font-medium text-secondary-foreground">
            Filtro attivo: solo possibili duplicati
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOnlyDuplicates(false)}
          >
            <X data-icon="inline-start" />
            Rimuovi
          </Button>
        </div>
      ) : null}

      {/* Barra di ricerca — sempre su una riga, tutto il resto vive nel drawer "Filtri" */}
      <div className="flex min-w-0 flex-row items-center gap-2 rounded-lg border border-border bg-card p-1 shadow-sm lg:p-2">
        <LeadSearchInput
          value={filters.search}
          onChange={(v) => handleFilterChange({ ...filters, search: v })}
        />
      </div>

      {/* Stato errore */}
      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Errore nel caricamento dei lead. Riprova.
        </div>
      ) : null}

      {/* Tabella — occupa lo spazio rimanente e scrolla internamente */}
      <div className="min-h-0 flex-1">
        <LeadTable
          leads={pageRows}
          columns={columns}
          columnWidths={columnWidths}
          onColumnWidthChange={(column, width) =>
            setColumnWidths((current) => ({ ...current, [column]: width }))
          }
          onColumnReorder={reorderColumns}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onConvert={(lead) => setConvertTarget(lead)}
          onDelete={(lead) => setDeleteTarget(lead)}
          onUpdate={(lead, patch) =>
            updateLead.mutate(
              { id: lead.id, patch },
              {
                onSuccess: () => toast.success("Lead aggiornato"),
                onError: () => toast.error("Aggiornamento non riuscito"),
              },
            )
          }
          onDuplicate={(lead) => {
            const copy = {
              ...lead,
              id: crypto.randomUUID(),
              "Nome Lead": `Copia di ${lead["Nome Lead"]}`,
              "Badge dell'attività": false,
              "Badge di nota": false,
              attivita: [],
              documenti: [],
            }
            createLead.mutate(copy, {
              onSuccess: () => toast.success("Lead duplicato"),
              onError: () => toast.error("Duplicazione non riuscita"),
            })
          }}
          onRefresh={() => {
            void queryClient.invalidateQueries({ queryKey: leadsKeys.lists() })
            void queryClient.invalidateQueries({ queryKey: leadsKeys.stats() })
          }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          density={density}
          loading={isFetching && !data}
        />
      </div>

      {/* Footer paginazione — sempre visibile e in primo piano */}
      <div className="sticky bottom-0 z-30 -mx-5 flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background/95 px-3 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {rangeStart}-{rangeEnd} di {total.toLocaleString("it-IT")}
            {selected.size > 0 ? ` · ${selected.size} selezionati` : ""}
          </span>
          <span className="truncate text-xs text-muted-foreground sm:hidden">
            {rangeStart}-{rangeEnd}/{total.toLocaleString("it-IT")}
          </span>
          <select
            aria-label="Numero di righe per pagina"
            value={String(rowsPerPage)}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value))
              setPage(1)
            }}
            className="h-7 shrink-0 rounded-md border border-input bg-card px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:h-8 sm:px-2 sm:text-sm"
          >
            {Object.entries(ROWS_ITEMS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 bg-card sm:h-7"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Pagina precedente"
          >
            <ChevronLeft data-icon="inline-start" />
            <span className="hidden sm:inline">Precedente</span>
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground sm:text-sm">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 bg-card sm:h-7"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Pagina successiva"
          >
            <span className="hidden sm:inline">Successivo</span>
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      {/* Toolbar azioni bulk */}
      <BulkToolbar
        count={selected.size}
        onChangeOwner={handleBulkOwner}
        onChangeStato={handleBulkStato}
        onExport={handleBulkExport}
        onEmail={() => setBulkEmailOpen(true)}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={() => setSelected(new Set())}
      />

      {/* Dialog invio email di massa */}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        recordTipo="lead"
        recordIds={selectedIds}
      />

      {/* Avviso export incompleto */}
      <ExportTruncatoDialog
        info={exportTruncato}
        onCancel={() => {
          pendingExport.current = null
          setExportTruncato(null)
        }}
        onConfirm={() => {
          pendingExport.current?.()
          pendingExport.current = null
          setExportTruncato(null)
        }}
      />

      {/* Dialog elimina bulk */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead selezionati</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {selected.size} lead
              </span>
              ? L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Elimina {selected.size} lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog elimina */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.["Nome Lead"] ?? ""}
              </span>
              ? L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog converti */}
      <Dialog
        open={convertTarget !== null}
        onOpenChange={(open) => !open && setConvertTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti a cliente</DialogTitle>
            <DialogDescription>
              Vuoi convertire{" "}
              <span className="font-semibold text-foreground">
                {convertTarget?.["Nome Lead"] ?? ""}
              </span>{" "}
              in cliente? Verrà creata una nuova scheda cliente con i dati del
              lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={confirmConvert}
            >
              Converti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewLeadDialog
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        onCreate={handleCreateLead}
      />

      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
