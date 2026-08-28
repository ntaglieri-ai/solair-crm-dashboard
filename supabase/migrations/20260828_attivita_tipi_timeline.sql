-- Allinea il vincolo di attivita.tipo ai tipi gia' gestiti dalla timeline CRM.
-- Il vincolo legacy accettava soltanto "nota", percio' gli eventi automatici
-- creati dal lead intake venivano scartati dopo il corretto salvataggio del lead.
alter table public.attivita
  drop constraint if exists attivita_tipo_check;

alter table public.attivita
  add constraint attivita_tipo_check
  check (tipo in ('nota', 'nuovo-lead', 'cambio-stato', 'email-open'));
