-- Popolamento iniziale di crm_email_accounts (la tabella e le policy RLS
-- esistono gia': questa migration inserisce SOLO dati, non tocca lo schema).
--
-- Due categorie di righe in una tabella sola, perche' `email` e' UNIQUE e un
-- indirizzo non puo' esistere due volte:
--
--  1. riga PERSONALE  — utente_id valorizzato, condivisa = false
--     La casella Aruba dell'utente, suo mittente di default.
--
--  2. riga CONDIVISA  — condivisa = true
--     Selezionabile da chiunque abbia ruoli.puo_scegliere_mittente.
--     info@ e commerciale@ sono ENTRAMBE le cose: appartengono a un utente
--     dedicato (che le ha come default) e restano scegliibili dagli altri.
--     vendite@ non ha un utente dedicato, quindi utente_id resta null.

-- ---------------------------------------------------------------------------
-- Step 1 — una riga per ogni utente attivo, con la sua casella personale.
-- ---------------------------------------------------------------------------
insert into crm_email_accounts (
  utente_id, nome_visualizzato, email, condivisa, is_default, attivo
)
select
  u.id,
  -- "Paola  Polimeni" ha due spazi in utenti.nome: normalizzati qui, non nel
  -- record utente, per non toccare dati fuori dallo scopo di questa migration.
  case lower(btrim(u.email))
    when 'info@solairgroup.it'        then 'Info Solair'
    when 'commerciale@solairgroup.it' then 'Commerciale Solair'
    else regexp_replace(btrim(u.nome), '\s+', ' ', 'g')
  end,
  lower(btrim(u.email)),
  -- Le due caselle di servizio nascono gia' condivise.
  lower(btrim(u.email)) in ('info@solairgroup.it', 'commerciale@solairgroup.it'),
  true,   -- is_default: e' il mittente proprio dell'utente
  true
from utenti u
where u.attivo = true
  and u.email is not null
  and btrim(u.email) <> ''
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- Step 2 — la sola casella condivisa senza utente dedicato.
-- ---------------------------------------------------------------------------
insert into crm_email_accounts (
  utente_id, nome_visualizzato, email, condivisa, is_default, attivo
)
values (null, 'Vendite Solair', 'vendite@solairgroup.it', true, false, true)
on conflict (email) do nothing;
