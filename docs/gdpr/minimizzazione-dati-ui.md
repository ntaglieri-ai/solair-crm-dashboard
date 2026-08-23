# Minimizzazione dei dati nelle viste: scostamenti rilevati

**Rilevato il**: 23 agosto 2026, sul branch `develop` e sulla configurazione di
produzione (`permessi_campo`, `permessi_record`).

**Cosa contiene**: solo gli scostamenti fra ciò che `permessi_campo` e
`permessi_record` dichiarano e ciò che l'applicazione fa davvero. Le parti
conformi non sono elencate. **Nessuna modifica è stata apportata**: questo è un
referto, non un intervento.

**Superficie esaminata**: viste di dettaglio, tabelle e liste, export CSV,
registro di audit, endpoint API.

---

## G1 — `permessi_campo` non è applicato in nessun punto dell'applicazione

**Gravità: la più alta del documento. È la causa comune di G2, G3 e G7.**

La tabella `permessi_campo` contiene **179 righe** di configurazione. Il motore
dei permessi espone due funzioni per leggerla:

- `canField(modulo, campo, "view" | "edit")`
- `fieldAccess(modulo, campo)` → `hidden` | `readonly` | `editable`

definite in `lib/permissions/engine.ts:33-41`.

**Nessuna delle due è chiamata da nessun punto del codice.** Ricerca su tutto
il repository (`.canField(` e `.fieldAccess(`): zero occorrenze al di fuori
della definizione stessa e della pagina di amministrazione che scrive la
configurazione.

Per confronto, le altre funzioni dello stesso motore sono usate regolarmente:
`canRecord` 22 volte, `canAction` 22, `canPage` 15.

Conseguenza: l'intera configurazione dei permessi di campo è **inerte**. Un
amministratore che imposta un campo su "nascosto" nella pagina Permessi vede
l'impostazione salvata e non produce alcun effetto. Il valore `hidden` non
nasconde niente, in nessuna vista.

Esempi presi dalla configurazione reale, tutti attualmente senza effetto:

| Ruolo | Modulo | Campo | Configurato | Effetto reale |
|---|---|---|---|---|
| AGENT | clienti | `iban` | hidden | visibile |
| AGENT | clienti | `codice_fiscale` | hidden | visibile |
| AGENT | clienti | `saldo`, `importo_contrattuale`, `n_1_tranche`, `n_2tranche` | hidden | visibili |
| AGENT | clienti | `via_indirizzo_postale`, `citta_indirizzo_postale`, `codice_postale_indirizzo` | hidden | visibili |
| AGENT | clienti | `pod`, `nome_intestatario_utenza_elettrica`, `cognome_intestatario_utenza_elettrica` | hidden | visibili |
| STANDARD | clienti | `iban`, `saldo`, `note_provvigioni`, `stato_provvigione` | hidden | visibili |
| DIRECTOR | clienti | `iban`, `modalita_di_pagamento`, `bonifico*`, `fattura*` | hidden | visibili |
| STANDARD | clienti | `codice_fiscale` | readonly | modificabile |
| AGENT | lead | `email` | readonly | modificabile |

## G2 — Il codice fiscale dei clienti esce nella lista e nell'export

La proiezione della lista clienti (`LIST_COLUMNS` in
`lib/clienti/repository.ts:19-35`) include `codice_fiscale`. La colonna
"Codice fiscale" è presente in `CLIENTE_COLUMNS` e quindi selezionabile dal
menu colonne da qualunque ruolo.

Percorsi in cui il dato esce:

1. tabella clienti, aggiungendo la colonna dal selettore;
2. menu contestuale di riga (`cliente-row-context-menu.tsx:345`) e intestazione
   di dettaglio (`cliente-detail-header.tsx:268`), che lo mostrano in modifica
   rapida;
3. export CSV, che scrive **tutte** le colonne di `CLIENTE_COLUMNS` (vedi G4).

Configurato: `hidden` per AGENT, `readonly` per STANDARD.
Reale: visibile a tutti, modificabile da tutti.

*Nota di misura*: 5 clienti su 16 hanno il codice fiscale valorizzato.

## G3 — La scheda cliente mostra IBAN e dati economici a ogni ruolo

`components/clienti/cliente-detail-content.tsx` non importa il provider dei
permessi e non esegue alcun controllo. La sezione "Pagamenti e finanziario"
rende incondizionatamente:

- `IBAN` (riga 591, con pulsante di copia negli appunti);
- `Saldo` (riga 623), `Importo Contrattuale` (590), `Importo Finanziamento`
  (633), `Sconto COMBO` (635), `Importo da Listino` (636), `Importo TICA`
  (637), `IVA` (638), `MOD. PAGAMENTO CT3.0` (649), `N. rate e importo rata`
  (634);
- più avanti `POD` (830), `Codice contratto PNRR` (847),
  `Indirizzo di ritiro merce` (884).

L'API che li fornisce (`getClienteById`, `DETAIL_COLUMNS`) proietta l'intero
insieme delle colonne Zoho, senza filtro per ruolo.

Configurato: `iban` è `hidden` per **DIRECTOR, STANDARD e AGENT** — cioè per
tutti tranne SUPERADMIN e ADMIN. Reale: visibile e copiabile da chiunque possa
aprire la scheda, e AGENT ha `view` su clienti.

*Nota di misura*: 5 clienti su 16 hanno l'IBAN valorizzato.

Lo stesso vale per la scheda lead (`lead-detail-content.tsx`): nessun controllo
di campo.

## G4 — L'export CSV scrive tutte le colonne, non quelle visibili

`downloadClientiCsv` (`app/(dashboard)/clienti/clienti-client.tsx:79`) e
`downloadLeadsCsv` (`app/(dashboard)/leads/leads-client.tsx:96`) costruiscono
l'intestazione con `CLIENTE_COLUMNS.map(c => c.id)` e
`LEAD_COLUMNS.map(c => c.id)`: **l'insieme completo**, non
`visibleCols`.

Conseguenza: un utente che ha nascosto le colonne sensibili dalla tabella
ottiene comunque un CSV che le contiene, per ogni campo effettivamente
proiettato dall'API. Chi esporta non ha modo di accorgersene dall'interfaccia.

Attenuante di fatto, non di progetto: per i clienti l'API di lista non proietta
`iban` né `saldo`, quindi oggi quelle colonne escono vuote nel CSV. Escono
piene `codice_fiscale`, `email`, `cellulare`, `nome`, `cognome`. Se un domani
`LIST_COLUMNS` venisse esteso, IBAN e saldo finirebbero nel CSV senza che
nessuno cambi il codice dell'export.

## G5 — Il permesso di export non è mai verificato

`permessi_record` prevede l'azione `export` accanto a `view/create/edit/delete`,
ed è configurata: **STANDARD e AGENT non ce l'hanno su lead e clienti**
(vedi la matrice nel [registro dei trattamenti](./registro-trattamenti.md)).

Ricerca su tutto il repository delle azioni effettivamente verificate via
`canRecord`: `delete` (16 volte), `edit` (2), `view` (2), `import` (1).
**`export` non compare mai.**

I due endpoint di export introdotti oggi (`/api/leads/export`,
`/api/clienti/export`) verificano `view`, coerentemente con il resto del
codice. Il risultato è che **STANDARD e AGENT possono scaricare il CSV di lead
e clienti pur non avendone il permesso configurato.**

Da decidere: se gli endpoint debbano passare a `canRecord(modulo, "export")`.
Non è stato cambiato stanotte perché è una modifica al controllo degli accessi
che toglie una possibilità a due ruoli, e va decisa, non dedotta.

## G6 — I record senza proprietario sono visibili a tutti gli autenticati

La policy RLS su `leads`, `clienti`, `compiti` e `installatori` ha la forma:

```
has_full_row_visibility()
  OR <tabella>_proprietario_id IS NULL
  OR <tabella>_proprietario_id = current_utente_id()
```

Il ramo centrale non ha condizioni: **ogni riga priva di proprietario è
leggibile da qualunque utente autenticato**, indipendentemente da ruolo e
scope.

Misurato in produzione il 23/08/2026:

| Tabella | Righe senza proprietario | Totale | Quota |
|---|---|---|---|
| `clienti` | 15 | 16 | **94%** |
| `leads` | 33 | 9.365 | 0,4% |

Per i clienti questo significa che la restrizione per proprietario, di fatto,
non restringe niente: quasi l'intera tabella è visibile a chiunque abbia un
account, AGENT compreso — e con essa, per G3, IBAN e dati economici.

Nota: la falla di accesso **anonimo** collegata a questa stessa espressione è
invece **chiusa**. Verificato il 23/08/2026 interrogando PostgREST con la sola
chiave anon su 15 tabelle: tutte restituiscono 0 righe. La migration
`20260822_restrict_crm_policies_to_authenticated.sql` risulta applicata.

## G7 — `permessi_campo` contiene regole per campi che non esistono

Per il modulo `lead`, la configurazione definisce l'accesso a cinque campi che
**non sono colonne della tabella `leads`**: `codice_fiscale`, `commissione`,
`costo_impianto`, `margine`, `note_interne`. Verificato sullo schema reale.

Sono regole che non potrebbero applicarsi neanche se G1 fosse risolto. Vanno
riviste insieme: una configurazione in parte fittizia rende difficile
distinguere ciò che è protetto da ciò che si crede protetto.

## G8 — Il registro di audit è leggibile da ogni utente autenticato

Su `audit_log` esiste una sola policy, `audit_log_select`, che concede la
lettura a chiunque sia autenticato (documentato in `lib/audit/log.ts:4-6`).

La pagina che lo mostra è riservata a SUPERADMIN (page key
`crm_settings.account.audit`), ma la restrizione è nell'interfaccia, non nei
dati: una chiamata diretta a PostgREST con la sessione di un utente qualsiasi
restituisce il registro.

Il registro contiene **l'indirizzo IP** degli utenti interni e, nei campi
`dati_prima`/`dati_dopo`, frammenti dei record modificati — quindi dati di lead
e clienti.

Volume attuale: 5 righe (il registro è entrato in funzione il 23/08/2026),
quindi l'esposizione è oggi trascurabile in quantità. Cresce da qui in avanti.

## G9 — Nessuna mascheratura in nessun punto

Non esiste nel codice alcuna funzione di offuscamento: nessun IBAN mostrato
come `IT••••1234`, nessun codice fiscale parziale. I valori sono resi in
chiaro ovunque compaiano, e `CopyField` sull'IBAN ne facilita la copia negli
appunti.

Questo è un dato di fatto, non necessariamente un difetto: la mascheratura ha
senso una volta deciso chi debba vedere cosa (G1). Va deciso insieme a quello.

---

## Ordine di intervento suggerito

1. **G1** — senza applicazione di `permessi_campo` non esiste minimizzazione
   per campo. Va deciso dove applicarlo: filtro server-side nelle proiezioni
   (che chiude anche G4) oppure controllo nei componenti (che lascia il dato
   nella risposta API).
2. **G6** — assegnare un proprietario ai 15 clienti scoperti, oppure rivedere
   il ramo `IS NULL` della policy. È l'intervento con il rapporto
   effetto/sforzo migliore.
3. **G5** — decidere se l'export debba verificare `export`.
4. **G7** — allineare la configurazione ai campi reali.
5. **G8** — valutare se restringere `audit_log_select`.
6. **G2, G3, G4, G9** — discendono da G1 e si chiudono con quello, salvo la
   scelta esplicita sulla mascheratura.
