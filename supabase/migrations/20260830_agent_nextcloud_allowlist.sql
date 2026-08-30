-- Rende esplicite le cartelle Nextcloud che il ruolo AGENT puo' vedere.
--
-- La prima migration aveva seedato alcune regole commerciali con path "nudi"
-- (LISTINI, Schede tecniche, ...), ma l'albero reale le contiene sotto
-- Vendita-Digitale/, Solair-Agenti/ o Solair-Ufficio/. Con il default sicuro
-- per AGENT (deny se nessuna regola matcha) servono regole sui path reali.

with seed(path_prefix, priorita, superadmin, admin, director, standard, agent) as (
  values
    ('Solair-Agenti/LISTINI',              90, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Vendita-Digitale/LISTINI',           91, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Solair-Agenti/Schede tecniche',     100, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Vendita-Digitale/Schede tecniche',  101, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Solair-Ufficio/Schede Tecniche',    102, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Vendita-Digitale/INSERZIONI ATTIVE', 110, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Solair-Agenti/Sponsorizzate',       120, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Solair-Ufficio/Sponsorizzate',      121, 'editable', 'editable', 'editable', 'editable', 'editable')
),
resolved as (
  select
    s.path_prefix,
    s.priorita,
    r.id as ruolo_id,
    case upper(coalesce(r.code, r.nome))
      when 'SUPERADMIN' then s.superadmin
      when 'ADMIN' then s.admin
      when 'DIRECTOR' then s.director
      when 'STANDARD' then s.standard
      when 'AGENT' then s.agent
      else null
    end as accesso
  from seed s
  cross join public.ruoli r
  where upper(coalesce(r.code, r.nome)) in ('SUPERADMIN', 'ADMIN', 'DIRECTOR', 'STANDARD', 'AGENT')
)
insert into public.permessi_cartelle_nextcloud (path_prefix, ruolo_id, accesso, priorita)
select path_prefix, ruolo_id, accesso, priorita
from resolved
where accesso is not null
on conflict (path_prefix, ruolo_id) do update set
  accesso = excluded.accesso,
  priorita = excluded.priorita,
  updated_at = now();
