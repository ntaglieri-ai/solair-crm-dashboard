-- Cache del TESTO estratto dai PDF di listino/offerte (Nextcloud).
--
-- Perche' esiste: /api/public/listino serviva i PDF grezzi in base64,
-- riscaricando tutti i file da Nextcloud ad ogni chiamata (27 file, ~9MB,
-- diversi secondi). Il chatbot del sito consuma quell'endpoint ad ogni
-- conversazione, quindi il costo si pagava ogni volta.
--
-- Qui si tiene il testo gia' estratto, indicizzato per `path` Nextcloud. Ad
-- ogni chiamata si fa solo la PROPFIND (leggera) e si confronta il
-- `fingerprint`: se combacia si riusa il testo salvato, altrimenti si
-- riscarica e ri-estrae solo quel file.
--
-- Il fingerprint e' l'ETag Nextcloud quando disponibile (cambia ad ogni
-- modifica del contenuto), con fallback su dimensione+data di modifica.
--
-- Non e' una fonte di verita': e' una cache derivata da Nextcloud. Si puo'
-- svuotare in qualsiasi momento (`delete from listino_cache`), la chiamata
-- successiva la ricostruisce.

begin;

create table if not exists public.listino_cache (
  id uuid primary key default gen_random_uuid(),
  -- Path DAV admin completo (es. Solair/Vendita-Digitale/LISTINI/x.pdf).
  -- Univoco: e' la chiave di upsert (on conflict (path)).
  path text unique not null,
  nome text not null,
  cartella text not null,
  fingerprint text not null,
  -- Null = estrazione fallita, oppure PDF senza testo perche' e' una
  -- scansione immagine (oggi Smart One / Power Plus / Premium Top, che sono
  -- offerte commerciali con i prezzi dentro l'immagine). In quel caso la riga
  -- resta utile lo stesso: dice alla route che per quel file non serve
  -- ritentare l'estrazione, basta riscaricarlo e passarlo come PDF.
  testo_estratto text,
  aggiornato_at timestamptz not null default now()
);

comment on table public.listino_cache is
  'Cache del testo estratto dai PDF di listino su Nextcloud, per /api/public/listino.';

alter table public.listino_cache enable row level security;

-- Nessuna policy: la tabella e' letta e scritta solo dalla route server-side
-- con il client service-role (che bypassa la RLS). Nessun client del browser
-- deve poterla leggere: /api/public/listino si autentica con la sua API key.

commit;

-- Verifica rapida dopo l'esecuzione:
-- select nome, cartella, length(testo_estratto) as caratteri, aggiornato_at
--   from listino_cache order by cartella, nome;
