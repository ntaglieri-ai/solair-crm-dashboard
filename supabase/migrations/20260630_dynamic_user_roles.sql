-- I ruoli sono gestiti dalla tabella public.ruoli. Il vecchio CHECK su
-- utenti.ruolo impedisce l'uso di SUPERADMIN e dei ruoli creati dal CRM.
alter table public.utenti
  drop constraint if exists utenti_ruolo_check;

-- Allinea il codice legacy al ruolo relazionato senza modificare le assegnazioni.
update public.utenti as u
set ruolo = r.code
from public.ruoli as r
where u.ruolo_id = r.id
  and u.ruolo is distinct from r.code;
