-- I ruoli sono gestiti dalla tabella public.ruoli. Il vecchio CHECK su
-- utenti.ruolo impedisce l'uso di SUPERADMIN e dei ruoli creati dal CRM.
alter table public.utenti
  drop constraint if exists utenti_ruolo_check;

-- Collega gli utenti legacy al ruolo corrispondente usando il codice,
-- indipendentemente da maiuscole e minuscole.
update public.utenti as u
set ruolo_id = r.id,
    ruolo = r.code
from public.ruoli as r
where u.ruolo_id is null
  and lower(u.ruolo) = lower(r.code);

-- Allinea il codice legacy al ruolo già relazionato senza modificare
-- l'assegnazione.
update public.utenti as u
set ruolo = r.code
from public.ruoli as r
where u.ruolo_id = r.id
  and u.ruolo is distinct from r.code;
