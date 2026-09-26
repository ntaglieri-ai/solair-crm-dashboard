// Campi a scelta multipla dei Clienti: un'unica colonna text con i valori
// separati da ";" senza spazi, lo stesso formato con cui arrivano da Zoho
// ("Installato;Necessario sopralluogo/intervento"). Lettura tollerante (spazi
// attorno al separatore), scrittura sempre nel formato canonico.

export const SEPARATORE_MULTIPLO = ";"

/** I singoli valori, senza vuoti e senza doppioni, nell'ordine in cui compaiono. */
export function valoriMultipli(value: unknown): string[] {
  const parti = Array.isArray(value)
    ? value.map((item) => String(item))
    : String(value ?? "").split(SEPARATORE_MULTIPLO)
  const visti = new Set<string>()
  const valori: string[] = []
  for (const parte of parti) {
    const valore = parte.trim()
    if (!valore || visti.has(valore)) continue
    visti.add(valore)
    valori.push(valore)
  }
  return valori
}

/** Valore da salvare: "" quando non resta nulla. */
export function unisciValoriMultipli(valori: readonly string[]): string {
  return valoriMultipli([...valori]).join(SEPARATORE_MULTIPLO)
}

/** Aggiunge il valore se manca, lo toglie se c'e'. */
export function alternaValoreMultiplo(corrente: unknown, valore: string): string {
  const valori = valoriMultipli(corrente)
  return unisciValoriMultipli(
    valori.includes(valore) ? valori.filter((item) => item !== valore) : [...valori, valore],
  )
}
