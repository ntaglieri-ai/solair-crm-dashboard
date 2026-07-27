-- installatore_tags non esiste ancora (verificato 26/07). Struttura
-- identica a cliente_tags, stesso pattern lead_tags/cliente_tags.
-- Migra anche i valori del vecchio campo singolo installatori.tag (testo
-- libero, un solo valore a record) nel nuovo sistema tag reale — stesso
-- procedimento fatto per clienti.tag il 25/07.

begin;

create table if not exists installatore_tags (
  installatore_id uuid not null references installatori(id) on delete cascade,
  tag_id uuid not null references tag(id) on delete cascade,
  assegnato_da uuid references utenti(id),
  assegnato_il timestamp with time zone not null default now(),
  primary key (installatore_id, tag_id)
);

alter table installatore_tags enable row level security;

-- Stesso pattern gia' verificato oggi su cliente_tags/documenti: aperta agli
-- autenticati, il vero controllo di accesso resta lato API
-- (requireApiRecord("installatori", ...)).
create policy "installatore_tags_authenticated" on installatore_tags
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 1) Inserisce ogni valore distinto trovato in installatori.tag (modulo
--    'installatore'), solo se non gia' presente (case-insensitive).
--    Colori assegnati ciclicamente dalla stessa palette dell'app.
with distinct_legacy_tags as (
  select distinct trim(tag) as nome
  from installatori
  where tag is not null and trim(tag) <> ''
),
nuovi_tag as (
  select
    nome,
    row_number() over (order by nome) as rn
  from distinct_legacy_tags dlt
  where not exists (
    select 1 from tag t
    where t.modulo = 'installatore' and lower(t.nome) = lower(dlt.nome)
  )
),
palette(colore, idx) as (
  values
    ('#3B82F6', 0), ('#22C55E', 1), ('#F97316', 2), ('#9CA3AF', 3),
    ('#EF4444', 4), ('#EAB308', 5), ('#14B8A6', 6), ('#8B5CF6', 7),
    ('#EC4899', 8), ('#06B6D4', 9), ('#84CC16', 10), ('#64748B', 11)
)
insert into tag (nome, colore, modulo)
select nt.nome, p.colore, 'installatore'
from nuovi_tag nt
join palette p on p.idx = (nt.rn - 1) % 12;

-- 2) Collega ogni installatore al proprio tag (ormai presente in tag).
insert into installatore_tags (installatore_id, tag_id)
select distinct i.id, t.id
from installatori i
join tag t on t.modulo = 'installatore' and lower(t.nome) = lower(trim(i.tag))
where i.tag is not null and trim(i.tag) <> ''
on conflict (installatore_id, tag_id) do nothing;

commit;

-- Verifica rapida dopo l'esecuzione:
-- select count(*) from tag where modulo = 'installatore';
-- select count(*) from installatore_tags;
