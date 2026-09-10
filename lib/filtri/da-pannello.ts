import type { AdvancedFilterState, FieldValue } from "@/lib/leads/advanced-filter-logic"
import type { CampoFiltrabile, Condizione, Gruppo, Nodo } from "./albero"

/**
 * Dal pannello all'albero.
 *
 * Nel pannello si compone un filtro spuntando campi e valori; nel
 * costruttore si compone lo stesso filtro come albero di gruppi. Sono due
 * modi di dire la stessa cosa, e chi ha appena filtrato dal pannello deve
 * poter salvare quello che vede senza rifarlo nella finestra grande.
 *
 * La conversione va in una direzione sola: il pannello sa esprimere meno —
 * tutte le condizioni in E, nessun gruppo — quindi un albero con gruppi
 * annidati non torna indietro in pillole senza perdere pezzi.
 */

function condizioneDaValore(
  campo: CampoFiltrabile,
  valore: FieldValue,
): Condizione | null {
  switch (valore.type) {
    case "text": {
      const testo = valore.contains.trim()
      if (!testo) return null
      return { tipo: "condizione", campo: campo.chiave, operatore: "contiene", valori: [testo] }
    }
    case "enum": {
      if (!valore.selected.length) return null
      // Piu' valori sullo stesso campo sono gia' un "oppure": nel pannello
      // si esprime selezionandone diversi, e "uno di" dice esattamente
      // questo senza bisogno di un gruppo.
      return {
        tipo: "condizione",
        campo: campo.chiave,
        operatore: "uno_di",
        valori: [...valore.selected],
      }
    }
    case "boolean": {
      if (valore.value === "all") return null
      return {
        tipo: "condizione",
        campo: campo.chiave,
        operatore: valore.value === "yes" ? "vero" : "falso",
        valori: [],
      }
    }
    case "number":
    case "date": {
      const da = valore.type === "number" ? valore.min : valore.from
      const a = valore.type === "number" ? valore.max : valore.to
      const daPieno = da.trim()
      const aPieno = a.trim()

      if (daPieno && aPieno) {
        return {
          tipo: "condizione",
          campo: campo.chiave,
          operatore: "fra",
          valori: [daPieno, aPieno],
        }
      }
      // Un solo estremo compilato non e' un intervallo incompleto da
      // scartare: e' un "da qui in poi" o un "fino a qui".
      if (daPieno) {
        return {
          tipo: "condizione",
          campo: campo.chiave,
          operatore: valore.type === "date" ? "dopo" : "maggiore",
          valori: [daPieno],
        }
      }
      if (aPieno) {
        return {
          tipo: "condizione",
          campo: campo.chiave,
          operatore: valore.type === "date" ? "prima" : "minore",
          valori: [aPieno],
        }
      }
      return null
    }
    default:
      return null
  }
}

/**
 * Traduce lo stato del pannello in un albero salvabile.
 *
 * I campi che il pannello ha ma il catalogo no vengono ignorati: meglio
 * salvare un filtro con una condizione in meno che rifiutare il salvataggio
 * per un campo che il costruttore non saprebbe comunque mostrare.
 */
export function alberoDaPannello(
  stato: AdvancedFilterState,
  catalogo: readonly CampoFiltrabile[],
): Gruppo {
  const perChiave = new Map(catalogo.map((campo) => [campo.chiave, campo]))
  const nodi: Nodo[] = []

  for (const [chiave, valore] of Object.entries(stato.fields)) {
    const campo = perChiave.get(chiave)
    if (!campo) continue
    const condizione = condizioneDaValore(campo, valore)
    if (condizione) nodi.push(condizione)
  }

  return { tipo: "gruppo", connettore: "e", nodi }
}
