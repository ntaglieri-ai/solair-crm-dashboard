update public.crm_layout_pagine
set
  label = 'Sopralluogo precontrattuale',
  updated_at = now()
where modulo = 'lead'
  and page_key = 'sopralluogo'
  and label = 'Sopralluogo';
