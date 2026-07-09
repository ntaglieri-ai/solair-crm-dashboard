-- Amplia il CHECK constraint su compiti.correlato_tipo per includere "scadenza".
-- La relazione "Correlato a" del compito diventa polimorfica Lead|Cliente|
-- Scadenza; il vincolo esistente sul DB (non tracciato nelle migration
-- precedenti — confermato con un probe di inserimento in verifica runtime)
-- ammetteva solo 'lead' | 'cliente' | NULL e va sostituito prima di collegare
-- compiti a una scadenza, altrimenti l'insert fallisce con
-- "violates check constraint \"compiti_correlato_tipo_check\"".
alter table public.compiti
  drop constraint if exists compiti_correlato_tipo_check;

alter table public.compiti
  add constraint compiti_correlato_tipo_check
  check (correlato_tipo is null or correlato_tipo in ('lead', 'cliente', 'scadenza'));
