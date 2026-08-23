-- Session & Access: lettura e revoca delle sessioni Supabase.
--
-- PERCHE' SERVONO DELLE FUNZIONI E NON UNA QUERY DIRETTA
-- PostgREST espone il solo schema `public`: supabase-js non puo' leggere
-- `auth.sessions` in nessun modo, nemmeno con la service_role. L'Admin API di
-- GoTrue non aiuta — verificato su auth-js 2.108.2 / GoTrue v2.195.0, gli unici
-- endpoint admin sono users, factors, passkeys, generate_link e oauth/clients:
-- non esiste "list sessions", e `admin.signOut(jwt)` pretende l'access token
-- dell'utente bersaglio, che per definizione non abbiamo.
-- Restano queste funzioni SECURITY DEFINER come unico ponte.
--
-- PERCHE' SONO SICURE
-- Il proprietario e' `postgres`, che ha USAGE su `auth` e SELECT/DELETE su
-- `auth.sessions` (verificato in produzione prima di scrivere). L'EXECUTE viene
-- revocato da public/anon/authenticated e concesso alla sola service_role:
-- girano quindi solo da route server che hanno gia' superato il gate di
-- permesso `crm_settings.account.session`. Nessun percorso dal browser.
-- `search_path` e' fissato come nelle altre SECURITY DEFINER del progetto.
--
-- EFFETTO REALE DELLA REVOCA — da sapere
-- `auth.refresh_tokens.session_id` ha FK ON DELETE CASCADE verso
-- `auth.sessions`, quindi cancellare la sessione cancella anche i suoi refresh
-- token: il rinnovo fallisce e l'utente cade fuori. NON e' pero' istantaneo: il
-- middleware verifica il JWT localmente via JWKS (ES256), senza interrogare
-- Supabase, quindi l'access token gia' emesso resta valido fino alla scadenza
-- (~1h). La UI lo dichiara invece di far finta che sia immediato.

begin;

-- --------------------------------------------------------------------------
-- 1. Elenco sessioni
-- --------------------------------------------------------------------------
-- `host(s.ip)` toglie la maschera /32 che inet porta con se': in tabella deve
-- comparire 101.57.167.152, non 101.57.167.152/32.
-- La join e' LEFT perche' esistono sessioni senza riga in `utenti` (le sessioni
-- di test create via generateLink+verifyOtp): vanno mostrate lo stesso, con
-- l'utente vuoto, non nascoste.

create or replace function public.crm_sessioni_attive()
returns table (
  session_id     uuid,
  auth_user_id   uuid,
  utente_id      uuid,
  utente_nome    text,
  utente_email   text,
  utente_ruolo   text,
  user_agent     text,
  ip             text,
  aal            text,
  creata_il      timestamptz,
  rinnovata_il   timestamptz,
  scade_il       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.user_id,
    u.id,
    u.nome,
    u.email,
    u.ruolo,
    s.user_agent,
    host(s.ip),
    s.aal::text,
    s.created_at,
    s.updated_at,
    s.not_after
  from auth.sessions s
  left join public.utenti u on u.auth_user_id = s.user_id
  order by s.updated_at desc nulls last;
$$;

-- --------------------------------------------------------------------------
-- 2. Revoca di una singola sessione
-- --------------------------------------------------------------------------
-- Ritorna il numero di righe cancellate (0 = sessione gia' sparita), cosi' la
-- route puo' distinguere "revocata" da "non esisteva piu'" senza una SELECT in
-- piu'.

create or replace function public.crm_revoca_sessione(p_session_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_session_id is null then
    return 0;
  end if;

  delete from auth.sessions where id = p_session_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- --------------------------------------------------------------------------
-- 3. Revoca di tutte le sessioni di un utente
-- --------------------------------------------------------------------------
-- `p_auth_user_id` NULL non significa "tutti": ritorna 0. Un parametro nullo
-- arrivato per errore non deve poter disconnettere l'intera azienda.
-- `p_escludi_sessione` serve a chi revoca le proprie altre sessioni senza
-- buttare fuori se stesso.

create or replace function public.crm_revoca_sessioni_utente(
  p_auth_user_id     uuid,
  p_escludi_sessione uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_auth_user_id is null then
    return 0;
  end if;

  delete from auth.sessions
  where user_id = p_auth_user_id
    and (p_escludi_sessione is null or id <> p_escludi_sessione);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- --------------------------------------------------------------------------
-- 4. Revoca globale
-- --------------------------------------------------------------------------
-- Funzione separata e con un nome che dice cosa fa, invece di un NULL magico
-- passato alla #3: "termina tutte le sessioni" e' l'operazione piu' distruttiva
-- della pagina e non deve essere raggiungibile per distrazione.
-- L'esclusione della sessione corrente e' la norma: chi preme il pulsante non
-- si chiude fuori dal CRM da solo, e la UI lo dichiara.

create or replace function public.crm_revoca_tutte_sessioni(
  p_escludi_sessione uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from auth.sessions
  where p_escludi_sessione is null or id <> p_escludi_sessione;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- --------------------------------------------------------------------------
-- 5. Privilegi
-- --------------------------------------------------------------------------
-- PostgreSQL concede EXECUTE a PUBLIC per default su ogni nuova funzione: su
-- una SECURITY DEFINER che legge e cancella sessioni altrui sarebbe una falla,
-- quindi la revoca e' esplicita e precede il grant.

revoke all on function public.crm_sessioni_attive()
  from public, anon, authenticated;
revoke all on function public.crm_revoca_sessione(uuid)
  from public, anon, authenticated;
revoke all on function public.crm_revoca_sessioni_utente(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.crm_revoca_tutte_sessioni(uuid)
  from public, anon, authenticated;

grant execute on function public.crm_sessioni_attive()
  to service_role;
grant execute on function public.crm_revoca_sessione(uuid)
  to service_role;
grant execute on function public.crm_revoca_sessioni_utente(uuid, uuid)
  to service_role;
grant execute on function public.crm_revoca_tutte_sessioni(uuid)
  to service_role;

-- --------------------------------------------------------------------------
-- 6. Indice per il conteggio dei login falliti per IP
-- --------------------------------------------------------------------------
-- Il nuovo /api/auth/login conta i `login_fallito` di un IP nella finestra
-- recente PRIMA di chiamare Supabase: e' sul percorso critico del login, quindi
-- non puo' appoggiarsi a idx_audit_log_tipo (che seleziona per tipo e poi
-- filtra). Indice parziale: copre solo le righe di quel tipo, che sono una
-- minoranza del registro.

create index if not exists idx_audit_log_login_falliti
  on public.audit_log (ip_address, created_at desc)
  where tipo_evento = 'login_fallito';

commit;
