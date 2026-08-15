create or replace function public.pubblica_catalogo_offerta_commerciale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.offerta_commerciale_cataloghi
     where id = p_id
       and stato in ('bozza', 'archiviato', 'pubblicato')
  ) then
    raise exception 'Catalogo pubblicabile non trovato';
  end if;

  update public.offerta_commerciale_cataloghi
     set stato = 'archiviato', aggiornato_at = now()
   where stato = 'pubblicato'
     and id <> p_id;

  update public.offerta_commerciale_cataloghi
     set stato = 'pubblicato', pubblicato_at = now(), aggiornato_at = now()
   where id = p_id;
end;
$$;
