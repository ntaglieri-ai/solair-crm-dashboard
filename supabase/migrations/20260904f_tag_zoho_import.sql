-- Gap trovato oggi (Vincenzo Spinuso): lo script di import storico da Zoho
-- (scripts/migrations/import-zoho-clienti.mjs, gia' girato) ha portato il
-- campo "Tag" come testo grezzo (clienti.tag, colonna text, valori separati
-- da virgola) ma non ha mai creato i tag veri collegati (tabella tag +
-- cliente_tags) — verificato: lo script non tocca ne' "tag" ne' "cliente_tags"
-- da nessuna parte. Risultato: nella UI (badge, filtro TAG) questi clienti
-- risultano senza nessun tag, anche se Zoho ne aveva assegnati.
--
-- Una tantum, come lo script di import note storiche (bug 5, 03/09): per
-- ogni cliente con "tag" non vuoto, per ogni nome-tag nel testo, trova (case
-- insensitive) o crea il tag reale, poi collega cliente_tags se manca.
-- "where not exists" invece di "on conflict" per non dipendere da un vincolo
-- univoco che potrebbe non esistere su cliente_tags.
do $$
declare
  cliente_row record;
  tag_name text;
  tag_id_trovato uuid;
  clienti_toccati integer := 0;
  legami_creati integer := 0;
begin
  for cliente_row in
    select id, tag from public.clienti
    where tag is not null and trim(tag) <> ''
  loop
    clienti_toccati := clienti_toccati + 1;

    foreach tag_name in array string_to_array(cliente_row.tag, ',')
    loop
      tag_name := trim(tag_name);
      continue when tag_name = '';

      select id into tag_id_trovato
      from public.tag
      where modulo = 'cliente' and lower(nome) = lower(tag_name)
      limit 1;

      if tag_id_trovato is null then
        insert into public.tag (nome, modulo, colore)
        values (tag_name, 'cliente', '#64748b')
        returning id into tag_id_trovato;
      end if;

      insert into public.cliente_tags (cliente_id, tag_id)
      select cliente_row.id, tag_id_trovato
      where not exists (
        select 1 from public.cliente_tags
        where cliente_id = cliente_row.id and tag_id = tag_id_trovato
      );
      if found then
        legami_creati := legami_creati + 1;
      end if;
    end loop;
  end loop;

  raise notice 'Clienti con tag testuale processati: %, legami cliente_tags creati: %',
    clienti_toccati, legami_creati;
end $$;
