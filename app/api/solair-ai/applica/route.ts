import { NextResponse, after } from "next/server"

import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { requireApiPage } from "@/lib/permissions/server"
import {
  collegaLettureAlRecord,
  registraLetture,
} from "@/lib/solair-ai/nextcloud"
import { smistaCampi } from "@/lib/solair-ai/campi"
import {
  aggiornaRecord,
  creaRecord,
  inserisciRevisioni,
  leggiRecord,
  scriviNotaRiepilogo,
  testoNota,
} from "@/lib/solair-ai/records"
import { ENTITA_LABEL, isEntitaAI } from "@/lib/solair-ai/tipi"
import type { CampoProposto, EsitoApplicazione, PropostaAI } from "@/lib/solair-ai/tipi"

export const dynamic = "force-dynamic"

/**
 * L'unico endpoint di SolairAI che scrive sui record.
 *
 * Sta separato dal turno di chat di proposito: e' il punto in cui una
 * conversazione diventa una modifica al CRM, e merita un permesso suo, un
 * audit suo e una rilettura del record — la proposta arriva dal client, e
 * fra la domanda e il "si'" il record puo' essere cambiato.
 */

type Payload = { proposta?: PropostaAI }

function pulisciFile(proposta: PropostaAI) {
  return (proposta.file ?? [])
    .filter((file) => typeof file?.path === "string" && file.path.trim() !== "")
    .map((file) => ({
      path: file.path,
      nome: file.nome ?? file.path.split("/").pop() ?? file.path,
      dimensione: typeof file.dimensione === "number" ? file.dimensione : null,
      modificatoIl: typeof file.modificatoIl === "string" ? file.modificatoIl : null,
      fingerprint: String(file.fingerprint ?? ""),
    }))
}

export async function POST(request: Request) {
  const guard = await requireApiPage("solair_ai")
  if (guard.response) return guard.response

  const permissions = guard.permissions
  if (!permissions.canAction("solair_ai.run")) {
    return NextResponse.json(
      { error: "Non hai il permesso di scrivere sul CRM con SolairAI." },
      { status: 403 },
    )
  }

  const utenteId = permissions.snapshot.subject.userId
  if (!utenteId) {
    return NextResponse.json({ error: "Utente CRM non risolto." }, { status: 400 })
  }

  const proposta = (await request.json().catch(() => null) as Payload | null)?.proposta
  if (!proposta || !isEntitaAI(proposta.entita) || !Array.isArray(proposta.campi)) {
    return NextResponse.json({ error: "Proposta non valida." }, { status: 400 })
  }

  const entita = proposta.entita
  // Il permesso di record vale anche qui: SolairAI non e' una scorciatoia
  // per scrivere su un modulo che l'utente non potrebbe toccare a mano.
  const moduloRecord = entita === "cliente" ? "clienti" : entita
  const azione = proposta.recordId ? "edit" : "create"
  if (!permissions.canRecord(moduloRecord, azione)) {
    return NextResponse.json(
      {
        error: `Non hai il permesso di ${azione === "edit" ? "modificare" : "creare"} ${ENTITA_LABEL[entita]}.`,
      },
      { status: 403 },
    )
  }

  const proposti: CampoProposto[] = proposta.campi
    .filter((campo) => typeof campo?.campo === "string" && typeof campo?.valore === "string")
    .map((campo) => ({
      campo: campo.campo,
      etichetta: typeof campo.etichetta === "string" ? campo.etichetta : campo.campo,
      valore: campo.valore,
      fonte: typeof campo.fonte === "string" ? campo.fonte : "",
    }))

  const file = pulisciFile(proposta)

  try {
    let recordId = proposta.recordId
    let creato = false
    let etichetta = proposta.recordEtichetta ?? proposta.nome

    let aggiornati: CampoProposto[] = []
    let inRevisione: CampoProposto[] = []
    let invariati: CampoProposto[] = []

    if (recordId) {
      // Rilettura obbligatoria: "campo vuoto -> scrivo" va deciso su quello
      // che c'e' adesso, non su quello che c'era quando ho fatto la domanda.
      const record = await leggiRecord(entita, recordId)
      if (!record) {
        return NextResponse.json(
          { error: `${ENTITA_LABEL[entita]} non trovato: forse e' stato eliminato nel frattempo.` },
          { status: 404 },
        )
      }
      etichetta = record.etichetta

      const smistamento = smistaCampi(entita, proposti, record.valori)
      await aggiornaRecord(entita, recordId, smistamento.daScrivere)
      await inserisciRevisioni(entita, recordId, utenteId, smistamento.inRevisione)

      aggiornati = smistamento.daScrivere.map((voce) => voce.campo)
      inRevisione = smistamento.inRevisione.map((voce) => voce.campo)
      invariati = smistamento.invariati
    } else {
      // Record nuovo: nessun campo e' "gia' pieno", quindi non ci sono
      // revisioni da aprire. Si smista comunque contro un record vuoto per
      // riusare la stessa validazione e normalizzazione dei valori.
      const smistamento = smistaCampi(entita, proposti, {})
      const record = await creaRecord(entita, proposta.nome, smistamento.daScrivere)
      recordId = record.id
      etichetta = record.etichetta
      creato = true

      aggiornati = smistamento.daScrivere.map((voce) => voce.campo)
      invariati = smistamento.invariati

      // Le letture fatte prima che il record esistesse vanno agganciate ora,
      // altrimenti quei file tornerebbero "nuovi" alla prossima domanda.
      await collegaLettureAlRecord(
        entita,
        recordId,
        file.map((voce) => voce.path),
      )
    }

    const fileRegistrati = await registraLetture(entita, recordId, utenteId, file)

    const nota = testoNota({ creato, file, aggiornati, inRevisione })
    await scriviNotaRiepilogo(entita, recordId, utenteId, nota)

    // `modulo` prende i valori del vocabolario audit (lead/cliente/
    // installatore): che la modifica arrivi da SolairAI lo dice la
    // descrizione, cosi' un evento resta filtrabile insieme a tutte le
    // altre modifiche dello stesso modulo invece di finire in una categoria
    // sua che nessuno pensa a guardare.
    const moduloAudit = entita
    after(() =>
      logAudit({
        tipo_evento: "modifica_record",
        attore: attoreDaPermessi(permissions),
        modulo: moduloAudit,
        record_id: recordId,
        descrizione:
          `SolairAI — ${creato ? "creato" : "aggiornato"} ${ENTITA_LABEL[entita]} "${etichetta}": ` +
          `${file.length} file letti, ${aggiornati.length} campi scritti, ${inRevisione.length} in revisione`,
        request,
      }),
    )

    return NextResponse.json({
      recordId,
      creato,
      aggiornati,
      inRevisione,
      invariati,
      fileRegistrati,
      nota,
    } satisfies EsitoApplicazione)
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Applicazione non riuscita."
    console.error("[solair-ai/applica]", messaggio)
    return NextResponse.json({ error: messaggio }, { status: 500 })
  }
}
