-- Password temporanea per nuovi utenti: campo che forza il cambio password
-- al primo login dopo la creazione account (vedi lib/auth/user-provisioning.ts).
-- Idempotente: rieseguibile senza effetti collaterali.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'utenti'
      and column_name = 'must_change_password'
  ) then
    alter table public.utenti
      add column must_change_password boolean not null default true;

    -- Le righe gia' esistenti (import Zoho, account provisionati manualmente)
    -- non sono mai passate dal flusso "password temporanea via email": non
    -- vanno bloccate al prossimo accesso.
    update public.utenti set must_change_password = false;
  end if;
end $$;

comment on column public.utenti.must_change_password is
  'true = utente deve impostare una nuova password (sostituendo quella temporanea) prima di poter accedere al resto del CRM.';

-- ---------------------------------------------------------------------------
-- Stato invio email di benvenuto (password temporanea). Stesso pattern
-- "loud, not silent" del provisioning Nextcloud: se l'invio fallisce l'utente
-- CRM resta creato ma lo stato e' visibile e rilanciabile dalla UI.
-- ---------------------------------------------------------------------------
alter table public.utenti
  add column if not exists welcome_email_status text not null default 'pending',
  add column if not exists welcome_email_error text;

alter table public.utenti
  drop constraint if exists utenti_welcome_email_status_check;
alter table public.utenti
  add constraint utenti_welcome_email_status_check
  check (welcome_email_status in ('pending', 'sent', 'failed'));

comment on column public.utenti.welcome_email_status is
  'Stato invio email di benvenuto con password temporanea: pending (mai inviata / da riprovare), sent, failed.';
comment on column public.utenti.welcome_email_error is
  'Ultimo errore di invio email di benvenuto (null se mai fallito).';
