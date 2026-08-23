# Documentazione GDPR — ricognizione tecnica

Quattro documenti prodotti il 23–24 agosto 2026 su richiesta di Nando.
Sono **ricognizioni tecniche**, non valutazioni legali: descrivono cosa fa il
sistema, non se sia conforme. Dove un'informazione non è deducibile dal codice
o dal database è scritto esplicitamente "da verificare con Nando".

| Documento | Risponde a |
|---|---|
| [Registro tecnico dei trattamenti](./registro-trattamenti.md) | quali dati esistono, dove risiedono, per quale finalità, chi vi accede |
| [Mappa fornitori e subprocessor](./fornitori-subprocessor.md) | quali servizi esterni sono collegati e cosa li raggiunge davvero |
| [Minimizzazione dei dati nelle viste](./minimizzazione-dati-ui.md) | dove i campi sensibili sono visibili a chi non dovrebbe vederli |
| [Privacy by design: stato reale](./privacy-by-design-stato.md) | cosa è implementato, e quali default permissivi sono rimasti |

## Metodo

Ogni affermazione è verificata su una fonte, indicata nel punto in cui compare:

- **schema e conteggi**: PostgREST sul progetto di produzione `solair-crm`,
  leggendo nomi di colonna e aggregati `count=exact` — mai valori di record;
- **permessi**: tabelle `ruoli`, `permessi_record`, `permessi_campo`;
- **residenza dei dati**: `supabase projects list`, `vercel.json`;
- **servizi esterni**: `vercel env ls production`, tabella `integrazioni`,
  ricerca dei consumatori nel codice;
- **comportamento del codice**: lettura diretta, con riferimenti a file e riga.

Dove una conclusione deriva dalle migration e non è stata riprodotta dal vivo,
è marcata come tale — vedi il punto 3 di *Privacy by design*, che è anche la
cosa più urgente da confermare.

## Due precisazioni che ricorrono

- **Il canale email non è Aruba** ma Amazon SES in Irlanda (`SMTP_HOST` in
  produzione). Un eventuale contratto Aruba riguarda altro.
- **La falla di accesso anonimo è chiusa**, verificata su 15 tabelle il
  23/08/2026. La documentazione precedente la dava come aperta.
