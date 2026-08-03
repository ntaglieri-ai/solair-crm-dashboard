begin;

update public.offerta_commerciale_cataloghi
set note = 'Import iniziale: Listino LUGLIO MONOFASE. Verificare prima dell uso commerciale.'
where id = '00000000-0000-4000-8000-000000000703'
  and note is distinct from 'Import iniziale: Listino LUGLIO MONOFASE. Verificare prima dell uso commerciale.';

commit;
