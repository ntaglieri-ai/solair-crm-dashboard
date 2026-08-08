-- Zone installatori (spec FASE 3, punto 3.3): lookup provincia -> installatori
-- suggeriti. Prima di questa migration la copertura territoriale viveva solo
-- nel vecchio campo testo installatori.tag ("SICILIA", "TOSCANA", ...): pura
-- etichetta, nessun motore di match.
--
-- Modello scelto: DUE tabelle.
--   * installatore_zone        — una riga per (installatore, regione). I nomi
--     regione sono ESATTAMENTE quelli canonici di
--     lib/dashboard/italy-regions.ts (REGION_PROVINCES): e' la stessa mappa
--     provincia->regione gia' usata dal tag "Italia", quindi il match runtime
--     e' un confronto diretto di stringhe.
--   * installatore_zone_raggio — il caso speciale PM Technology ("Miradolo
--     Terme + raggio 100km"). Tabella separata e NON colonne nullable su
--     installatore_zone perche' la semantica e' diversa (cerchio geografico vs
--     regione amministrativa, match a distanza vs uguaglianza) e tenerla a
--     parte lascia regione NOT NULL senza righe mezze-vuote; un installatore
--     puo' anche avere entrambe le coperture in futuro.
--
-- Sovrapposizioni (Sicilia coperta da 3, Toscana/nord da 2): NON risolte con
-- priorita' automatica, per decisione presa in spec — il sistema mostra tutti
-- i compatibili come suggeriti e la scelta resta manuale.

begin;

create table if not exists installatore_zone (
  id uuid primary key default gen_random_uuid(),
  installatore_id uuid not null references installatori(id) on delete cascade,
  regione text not null,
  created_at timestamp with time zone not null default now(),
  unique (installatore_id, regione)
);

create index if not exists installatore_zone_regione_idx
  on installatore_zone (regione);

create table if not exists installatore_zone_raggio (
  installatore_id uuid primary key references installatori(id) on delete cascade,
  -- Punto di riferimento leggibile ("Miradolo Terme (PV)"): compare cosi'
  -- com'e' nei motivi dei suggerimenti in UI.
  etichetta text not null,
  lat double precision not null,
  lng double precision not null,
  raggio_km numeric not null check (raggio_km > 0),
  created_at timestamp with time zone not null default now()
);

alter table installatore_zone enable row level security;
alter table installatore_zone_raggio enable row level security;

-- Stesso pattern di installatore_tags: aperta agli autenticati, il vero
-- controllo di accesso resta lato API (requireApiRecord("installatori", ...)).
create policy "installatore_zone_authenticated" on installatore_zone
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "installatore_zone_raggio_authenticated" on installatore_zone_raggio
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- SEED dalla procedura Vito.
--
-- Verifica fatta sull'anagrafica reale (08/08/2026, 12 installatori a DB):
-- 4 degli 8 nomi della procedura NON esistono in installatori — RSM Global,
-- Tullio Bruno, Team Green, Saitta Giustino. Vengono creati qui con la sola
-- anagrafica minima (nome + attivo + nota di provenienza): senza il record
-- la zona non avrebbe a chi agganciarsi. Gli altri 4 matchano cosi':
--   Diesse        -> "DIESSE IMPIANTI"
--   CAGI          -> "Ca.Gi Srl"
--   Solair Group  -> "Solair Group srl"
--   PM Technologi -> "Pm-technology _Massimo Popano"
-- ---------------------------------------------------------------------------

insert into installatori (nome, attivo, note)
select v.nome, true,
       'Creato dal seed zone installatori (procedura Vito, FASE 3.3) — anagrafica da completare.'
from (values
  ('RSM Global'),
  ('Tullio Bruno'),
  ('Team Green'),
  ('Saitta Giustino')
) as v(nome)
where not exists (
  select 1 from installatori i
  where i.nome ilike '%' || v.nome || '%'
);

-- Zone regionali. Nota su Diesse: la procedura Vito dice "Tutta Italia" e qui
-- si segue la procedura (tutte e 20 le regioni), ma il vecchio tag ereditato
-- da Zoho diceva "ITALIA (ECCETTO SICILIA)" — se quella era la verita'
-- operativa basta cancellare la riga (Diesse, Sicilia). In ogni caso e' solo
-- un suggerimento in piu': la scelta resta manuale.
--
-- Interpretazione delle descrizioni a voce:
--   "Toscana e regioni a nord delle Marche" (RSM Global, Team Green) =
--     Toscana + Emilia-Romagna, Liguria e tutto il Nord.
--   "Marche, Emilia-Romagna, Liguria e regioni a nord" (Saitta Giustino) =
--     le tre nominate + tutto il Nord.
--   "Marche, Lazio, Umbria, Molise, Centro Italia" (Tullio Bruno) = le
--     quattro nominate + Toscana e Abruzzo (il "Centro Italia" della frase;
--     Abruzzo incluso per non lasciare un buco tra Marche, Lazio e Molise).
with regioni(regione) as (
  values
    ('Piemonte'), ('Valle d''Aosta/Vallée d''Aoste'), ('Lombardia'),
    ('Trentino-Alto Adige/Südtirol'), ('Veneto'), ('Friuli-Venezia Giulia'),
    ('Liguria'), ('Emilia-Romagna'), ('Toscana'), ('Umbria'), ('Marche'),
    ('Lazio'), ('Abruzzo'), ('Molise'), ('Campania'), ('Puglia'),
    ('Basilicata'), ('Calabria'), ('Sicilia'), ('Sardegna')
),
nord(regione) as (
  values
    ('Piemonte'), ('Valle d''Aosta/Vallée d''Aoste'), ('Lombardia'),
    ('Trentino-Alto Adige/Südtirol'), ('Veneto'), ('Friuli-Venezia Giulia'),
    ('Liguria'), ('Emilia-Romagna')
),
coppie(pattern, regione) as (
  select '%diesse%', regione from regioni
  union all select '%ca.gi%', 'Sicilia'
  union all select 'solair group%', 'Sicilia'
  union all select '%rsm global%', regione from nord
  union all select '%rsm global%', 'Toscana'
  union all select '%team%green%', regione from nord
  union all select '%team%green%', 'Toscana'
  union all select '%saitta%', regione from nord
  union all select '%saitta%', 'Marche'
  union all select '%tullio%bruno%', r
    from (values ('Marche'), ('Lazio'), ('Umbria'), ('Molise'), ('Toscana'), ('Abruzzo')) as t(r)
)
insert into installatore_zone (installatore_id, regione)
select i.id, c.regione
from coppie c
join installatori i on i.nome ilike c.pattern
on conflict (installatore_id, regione) do nothing;

-- PM Technology: Miradolo Terme (PV) + raggio 100 km. Coordinate del centro
-- del comune (45°10'N 9°27'E).
insert into installatore_zone_raggio (installatore_id, etichetta, lat, lng, raggio_km)
select i.id, 'Miradolo Terme (PV)', 45.1667, 9.4500, 100
from installatori i
where i.nome ilike '%pm-technolog%'
on conflict (installatore_id) do nothing;

-- Guardia finale: se uno degli 8 non ha ricevuto nemmeno una zona (nome a DB
-- cambiato rispetto ai pattern qui sopra), la migration fallisce TUTTA invece
-- di lasciare un seed parziale silenzioso.
do $$
declare
  mancanti text;
begin
  select string_agg(attesi.nome_atteso, ', ') into mancanti
  from (values
    ('Diesse', '%diesse%'),
    ('CAGI', '%ca.gi%'),
    ('Solair Group', 'solair group%'),
    ('RSM Global', '%rsm global%'),
    ('Tullio Bruno', '%tullio%bruno%'),
    ('Team Green', '%team%green%'),
    ('Saitta Giustino', '%saitta%'),
    ('PM Technology', '%pm-technolog%')
  ) as attesi(nome_atteso, pattern)
  where not exists (
    select 1
    from installatori i
    where i.nome ilike attesi.pattern
      and (
        exists (select 1 from installatore_zone z where z.installatore_id = i.id)
        or exists (select 1 from installatore_zone_raggio r where r.installatore_id = i.id)
      )
  );
  if mancanti is not null then
    raise exception 'Seed zone installatori incompleto, nessuna zona per: %', mancanti;
  end if;
end $$;

commit;

-- Verifica rapida dopo l'esecuzione:
-- select i.nome, count(z.id) as regioni
--   from installatori i join installatore_zone z on z.installatore_id = i.id
--   group by i.nome order by i.nome;
-- select i.nome, r.etichetta, r.raggio_km
--   from installatore_zone_raggio r join installatori i on i.id = r.installatore_id;
