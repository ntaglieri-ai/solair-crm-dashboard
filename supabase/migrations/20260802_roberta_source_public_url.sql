alter table public.roberta_knowledge_sources
  add column if not exists public_url text;

comment on column public.roberta_knowledge_sources.public_url is
  'Link pubblico opzionale verso pagina o PDF da mostrare/citare nel chatbot.';
