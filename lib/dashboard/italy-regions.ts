const REGION_PROVINCES: Record<string, string[]> = {
  Piemonte: ["AL", "AT", "BI", "CN", "NO", "TO", "VB", "VC", "ALESSANDRIA", "ASTI", "BIELLA", "CUNEO", "NOVARA", "TORINO", "VERBANO CUSIO OSSOLA", "VERCELLI"],
  "Valle d'Aosta/Vallée d'Aoste": ["AO", "AOSTA", "VALLE D AOSTA"],
  Lombardia: ["BG", "BS", "CO", "CR", "LC", "LO", "MB", "MI", "MN", "PV", "SO", "VA", "BERGAMO", "BRESCIA", "COMO", "CREMONA", "LECCO", "LODI", "MONZA", "MILANO", "MANTOVA", "PAVIA", "SONDRIO", "VARESE"],
  "Trentino-Alto Adige/Südtirol": ["BZ", "TN", "BOLZANO", "TRENTO", "TRENTINO ALTO ADIGE"],
  Veneto: ["BL", "PD", "RO", "TV", "VE", "VI", "VR", "BELLUNO", "PADOVA", "ROVIGO", "TREVISO", "VENEZIA", "VICENZA", "VERONA"],
  "Friuli-Venezia Giulia": ["GO", "PN", "TS", "UD", "GORIZIA", "PORDENONE", "TRIESTE", "UDINE", "FRIULI VENEZIA GIULIA"],
  Liguria: ["GE", "IM", "SP", "SV", "GENOVA", "IMPERIA", "LA SPEZIA", "SAVONA"],
  "Emilia-Romagna": ["BO", "FC", "FE", "MO", "PC", "PR", "RA", "RE", "RN", "BOLOGNA", "FORLI CESENA", "FERRARA", "MODENA", "PIACENZA", "PARMA", "RAVENNA", "REGGIO EMILIA", "RIMINI", "EMILIA ROMAGNA"],
  Toscana: ["AR", "FI", "GR", "LI", "LU", "MS", "PI", "PO", "PT", "SI", "AREZZO", "FIRENZE", "GROSSETO", "LIVORNO", "LUCCA", "MASSA CARRARA", "PISA", "PRATO", "PISTOIA", "SIENA"],
  Umbria: ["PG", "TR", "PERUGIA", "TERNI"],
  Marche: ["AN", "AP", "FM", "MC", "PU", "ANCONA", "ASCOLI PICENO", "FERMO", "MACERATA", "PESARO URBINO"],
  Lazio: ["FR", "LT", "RI", "RM", "VT", "FROSINONE", "LATINA", "RIETI", "ROMA", "VITERBO"],
  Abruzzo: ["AQ", "CH", "PE", "TE", "L AQUILA", "CHIETI", "PESCARA", "TERAMO"],
  Molise: ["CB", "IS", "CAMPOBASSO", "ISERNIA"],
  Campania: ["AV", "BN", "CE", "NA", "SA", "AVELLINO", "BENEVENTO", "CASERTA", "NAPOLI", "SALERNO"],
  Puglia: ["BA", "BR", "BT", "FG", "LE", "TA", "BARI", "BRINDISI", "BARLETTA ANDRIA TRANI", "FOGGIA", "LECCE", "TARANTO"],
  Basilicata: ["MT", "PZ", "MATERA", "POTENZA"],
  Calabria: ["CS", "CZ", "KR", "RC", "VV", "COSENZA", "CATANZARO", "CROTONE", "REGGIO CALABRIA", "VIBO VALENTIA"],
  Sicilia: ["AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP", "AGRIGENTO", "CALTANISSETTA", "CATANIA", "ENNA", "MESSINA", "PALERMO", "RAGUSA", "SIRACUSA", "TRAPANI"],
  Sardegna: ["CA", "CI", "NU", "OR", "OT", "SS", "SU", "CAGLIARI", "NUORO", "ORISTANO", "SASSARI", "SUD SARDEGNA", "OLBIA TEMPIO", "CARBONIA IGLESIAS"],
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
}

const PROVINCE_TO_REGION = new Map<string, string>()
for (const [region, provinces] of Object.entries(REGION_PROVINCES)) {
  for (const province of provinces) PROVINCE_TO_REGION.set(normalize(province), region)
}

export function regionFromProvince(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  return PROVINCE_TO_REGION.get(normalize(value)) ?? null
}
