-- Stesso buco trovato su Clienti, ma su Installatori: lo script di import
-- (scripts/migrations/import-zoho-installatori.mjs, gia' girato) scrive il
-- testo grezzo del tag nella colonna "tag" (installatori.tag) ma non tocca
-- mai "tag" ne' "installatore_tags" — verificato, zero riferimenti nello
-- script. I Lead invece erano corretti: il loro script crea/collega i tag
-- veri gia' in fase di import.
do $$
declare
  installatore_row record;
  tag_name text;
  tag_id_trovato uuid;
  installatori_toccati integer := 0;
  legami_creati integer := 0;
begin
  for installatore_row in
    select id, tag from public.installatori
    where tag is not null and trim(tag) <> ''
  loop
    installatori_toccati := installatori_toccati + 1;

    foreach tag_name in array string_to_array(installatore_row.tag, ',')
    loop
      tag_name := trim(tag_name);
      continue when tag_name = '';

      select id into tag_id_trovato
      from public.tag
      where modulo = 'installatore' and lower(nome) = lower(tag_name)
      limit 1;

      if tag_id_trovato is null then
        insert into public.tag (nome, modulo, colore)
        values (tag_name, 'installatore', '#64748b')
        returning id into tag_id_trovato;
      end if;

      insert into public.installatore_tags (installatore_id, tag_id)
      select installatore_row.id, tag_id_trovato
      where not exists (
        select 1 from public.installatore_tags
        where installatore_id = installatore_row.id and tag_id = tag_id_trovato
      );
      if found then
        legami_creati := legami_creati + 1;
      end if;
    end loop;
  end loop;

  raise notice 'Installatori con tag testuale processati: %, legami installatore_tags creati: %',
    installatori_toccati, legami_creati;
end $$;
