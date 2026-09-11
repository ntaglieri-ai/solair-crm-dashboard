export type RecordCandidatoDocumento = {
  id: string
  etichetta: string
}

export type MatchRecordDocumento =
  | { stato: "matched"; record: RecordCandidatoDocumento; score: number }
  | { stato: "none"; motivo: string }
  | { stato: "ambiguous"; candidati: RecordCandidatoDocumento[] }

function normalizza(valore: string): string {
  return valore
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function paroleNome(nome: string): string[] {
  return normalizza(nome)
    .split(" ")
    .filter((parola) => parola.length > 1)
}

function contieneSequenza(testo: string, parole: string[]) {
  return testo.includes(parole.join(" "))
}

function scoreRecord(record: RecordCandidatoDocumento, testo: string): number {
  const parole = paroleNome(record.etichetta)
  if (parole.length === 0) return 0

  const paroleDistinte = [...new Set(parole)]
  if (!paroleDistinte.every((parola) => testo.includes(parola))) return 0

  // Un solo token e' troppo fragile: "Mario" o "Srl" non bastano per muovere
  // file e CRM in automatico. Lo accettiamo solo se e' un identificativo lungo.
  if (paroleDistinte.length === 1 && paroleDistinte[0].length < 8) return 0

  let score = paroleDistinte.length * 10
  if (contieneSequenza(testo, parole)) score += 20
  if (testo.includes(`/${parole.join(" ")}/`)) score += 10
  return score
}

export function scegliRecordPerDocumento(
  records: RecordCandidatoDocumento[],
  params: { path: string; nome: string; testo: string },
): MatchRecordDocumento {
  const testo = normalizza(`${params.path} ${params.nome} ${params.testo.slice(0, 80_000)}`)
  if (!testo) return { stato: "none", motivo: "documento vuoto" }

  const candidati = records
    .map((record) => ({ record, score: scoreRecord(record, testo) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)

  if (candidati.length === 0) return { stato: "none", motivo: "nessun record riconosciuto" }

  const migliore = candidati[0]
  const pari = candidati.filter((match) => match.score === migliore.score)
  if (pari.length > 1) {
    return { stato: "ambiguous", candidati: pari.map((match) => match.record) }
  }

  return { stato: "matched", record: migliore.record, score: migliore.score }
}
