-- Interruttore globale del blocco invii senza consenso.
--
-- La chiave e' volutamente PIATTA, senza prefisso. Per le policy introdotte da
-- 20260823_crm_settings_write_policies.sql questo la colloca nella classe
-- "nessuna policy di scrittura: solo service_role", insieme a
-- session_timeout_minutes, max_login_attempts e ip_block_enabled — cioe' la
-- stessa classe delle altre chiavi di sicurezza. Nessun utente autenticato
-- puo' scriverla passando da PostgREST, nemmeno un SUPERADMIN: l'unica via e'
-- app/api/crm-settings/consenso-enforcement/route.ts, che usa il service_role
-- e richiede comunque il ruolo SUPERADMIN.
--
-- Il valore nasce true: il default e' bloccare. lib/email/consent-enforcement.ts
-- torna comunque true anche se la riga manca o non e' leggibile, quindi questo
-- seed rende lo stato esplicito, non lo istituisce.
insert into public.crm_settings (chiave, valore, descrizione)
values (
  'consenso_enforcement_attivo',
  'true'::jsonb,
  'Blocco invii email verso contatti senza consenso. Spento = invii senza filtro.'
)
on conflict (chiave) do nothing;
