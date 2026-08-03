-- Modulo Offerta Commerciale.
-- Nextcloud conserva i documenti originali; il CRM conserva snapshot
-- strutturati, versionati e pubblicabili solo dopo revisione umana.

begin;

create table if not exists public.permessi_azione (
  ruolo_id uuid not null references public.ruoli(id) on delete cascade,
  azione text not null,
  abilitato boolean not null default false,
  primary key (ruolo_id, azione)
);

create table if not exists public.offerta_commerciale_cataloghi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  stato text not null default 'bozza' check (stato in ('bozza', 'pubblicato', 'archiviato')),
  valido_dal date,
  valido_al date,
  fonte_path text,
  fonte_fingerprint text,
  fotovoltaico jsonb not null default '[]'::jsonb,
  accumuli jsonb not null default '[]'::jsonb,
  accessori jsonb not null default '[]'::jsonb,
  sconti jsonb not null default '[]'::jsonb,
  note text,
  pubblicato_at timestamptz,
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now()
);

create unique index if not exists offerta_commerciale_un_pubblicato_idx
  on public.offerta_commerciale_cataloghi (stato) where stato = 'pubblicato';

create table if not exists public.offerta_commerciale_documenti (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('listino', 'locandina', 'copertina', 'altro')),
  fingerprint text,
  dimensione_kb integer,
  modificato_at timestamptz,
  sincronizzato_at timestamptz not null default now()
);

create table if not exists public.offerta_commerciale_offerte (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  descrizione text,
  pdf_path text,
  cover_path text,
  valido_dal date,
  valido_al date,
  pubblicata boolean not null default false,
  ordinamento integer not null default 0,
  configurazioni jsonb not null default '[]'::jsonb,
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now()
);

create index if not exists offerta_commerciale_offerte_pubblicate_idx
  on public.offerta_commerciale_offerte (pubblicata, valido_dal, valido_al, ordinamento);
create unique index if not exists offerta_commerciale_offerte_pdf_path_idx
  on public.offerta_commerciale_offerte (pdf_path);

alter table public.offerta_commerciale_cataloghi enable row level security;
alter table public.offerta_commerciale_documenti enable row level security;
alter table public.offerta_commerciale_offerte enable row level security;

create or replace function public.pubblica_catalogo_offerta_commerciale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.offerta_commerciale_cataloghi where id = p_id and stato = 'bozza') then
    raise exception 'Catalogo in bozza non trovato';
  end if;
  update public.offerta_commerciale_cataloghi
     set stato = 'archiviato', aggiornato_at = now()
   where stato = 'pubblicato';
  update public.offerta_commerciale_cataloghi
     set stato = 'pubblicato', pubblicato_at = now(), aggiornato_at = now()
   where id = p_id;
end;
$$;

-- Accesso esclusivamente server-side dopo i controlli del permission engine.

insert into public.offerta_commerciale_cataloghi (
  id, nome, stato, valido_dal, fotovoltaico, accumuli, accessori, sconti, note, pubblicato_at
) values (
  '00000000-0000-4000-8000-000000000703',
  'Listino luglio - Monofase',
  'pubblicato',
  '2026-07-01',
  '[{"kwp":3,"prezzo":5290},{"kwp":4,"prezzo":6000},{"kwp":5,"prezzo":6590},{"kwp":6,"prezzo":7290},{"kwp":7,"prezzo":7890},{"kwp":8,"prezzo":8490},{"kwp":9,"prezzo":8990},{"kwp":10,"prezzo":9790}]'::jsonb,
  '[
    {"marca":"BYD","garanzia_anni":15,"ip":"IP65","tensione":"alta","taglie":[5,12.9,17.2,21.4,29.8],"prezzi":{"3":[5000,6000,7600,8500,10300],"4":[4790,5790,7390,8290,10090],"5":[4700,5700,7300,8200,10000],"6":[4500,5500,7100,8000,9800],"7":[4400,5400,7000,7900,9700],"8":[4400,5400,7000,7900,9700],"9":[4700,5700,7300,8300,10100],"10":[4200,6200,7800,8800,10600]}},
    {"marca":"Sineng","garanzia_anni":12,"ip":"IP65","tensione":"alta","taglie":[5,10.6,15.9,21.2,31.8],"prezzi":{"3":[2000,3000,4300,5600,7600],"4":[1790,2790,4090,5390,7390],"5":[1700,2700,4000,5300,7300],"6":[1500,2500,3800,5100,7100],"7":[1400,2400,3700,5000,7000],"8":[1800,2800,4100,5400,7400],"9":[2100,3100,4400,5700,7700],"10":[1800,2800,4100,5400,7400]}},
    {"marca":"SolaX","garanzia_anni":10,"ip":"IP65","tensione":"alta","taglie":[5.8,11.6,17.4,23.2],"prezzi":{"3":[3900,5800,7700,10100],"4":[3190,5090,6990,9390],"5":[2600,4500,6400,8800],"6":[1900,3800,5700,8100],"7":[1900,3800,5600,8100],"8":[2300,4100,6000,8400],"9":[2600,4500,6300,8800],"10":[3100,5000,6800,9300]}},
    {"marca":"Solis","garanzia_anni":10,"ip":"IP20","tensione":"bassa","taglie":[10,16,20,32],"prezzi":{"3":[2100,2700,4000,5200],"4":[1890,2490,3790,4990],"5":[1800,2400,3700,4900],"6":[1600,2200,3500,4700],"7":[1500,2200,3400,4700],"8":[1900,2500,3800,5100],"9":[2200,2900,4100,5400],"10":[2700,3400,4600,5900]}},
    {"marca":"Sungrow","garanzia_anni":10,"ip":"IP65","tensione":"alta","taglie":[5,10,15,20],"prezzi":{"3":[3600,5200,6900,8500],"4":[2890,4490,6190,7790],"5":[2300,3900,5600,7200],"6":[1600,3200,4900,6500],"7":[1600,3200,4900,6500],"8":[2000,3600,5300,6900],"9":[2400,4000,5700,7300],"10":[2900,4500,6200,7800]}}
  ]'::jsonb,
  '[{"nome":"Zavorre","prezzo":100,"unita":"€/kWp","scontabile":true},{"nome":"Zavorre a vela","prezzo":150,"unita":"€/kWp","scontabile":true},{"nome":"Wall Box SolaxPower / Sungrow","prezzo":1500,"prezzo_combo":1000,"unita":"€","scontabile":false},{"nome":"Ottimizzatori Tigo","prezzo":150,"unita":"€/kWp","scontabile":true},{"nome":"Tigo Cloud Connect","prezzo":600,"unita":"€","scontabile":false},{"nome":"Secondo inverter in parallelo","prezzo":1500,"unita":"€","scontabile":false}]'::jsonb,
  '[{"zona":"A","kwp_min":3,"kwp_max":10,"percentuale":5,"eps_prezzo":500,"eps_omaggiabile":false},{"zona":"B","kwp_min":3,"kwp_max":7,"percentuale":5,"eps_prezzo":250,"eps_omaggiabile":true},{"zona":"B","kwp_min":8,"kwp_max":10,"percentuale":10,"eps_prezzo":250,"eps_omaggiabile":true}]'::jsonb,
  'Import iniziale: Listino LUGLIO MONOFASE. Verificare prima dell uso commerciale.',
  now()
) on conflict (id) do nothing;

-- Permesso pagina a tutti i ruoli esistenti; modifica solo ad Admin/Superadmin.
insert into public.permessi_pagina (ruolo_id, pagina, accesso)
select id, 'offerta_commerciale', case when upper(coalesce(code, '')) in ('ADMIN','SUPERADMIN','DIRECTOR') then 'rw' else 'r' end
from public.ruoli
on conflict (ruolo_id, pagina) do nothing;

insert into public.permessi_azione (ruolo_id, azione, abilitato)
select id, 'offerta_commerciale.manage', upper(coalesce(code, '')) in ('ADMIN','SUPERADMIN')
from public.ruoli
on conflict (ruolo_id, azione) do nothing;

commit;
