// Isolated PostgreSQL tests. No .env, Supabase connection or business data.
// Usage: node scripts/qa/report-vito-sql.mjs <absolute path to pglite/dist/index.js>
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
const sqlFile = (name) => readFile(new URL(`../../${name}`, import.meta.url), 'utf8')
const rows = async (sql, params = []) => (await db.query(sql, params)).rows
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks++ }
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table utenti (id uuid primary key, nome text);
    create table leads (id uuid primary key default gen_random_uuid(), nome_lead text, nome text,
      cognome text, email text, telefono text, sede text, lead_proprietario_id uuid,
      provincia text, stato_lead text, account_convertito_id uuid, updated_at timestamptz);
    create table clienti (id uuid primary key default gen_random_uuid(), nome text, cognome text,
      nome_clienti text, email text, cellulare text, codice_fiscale text, tag text, stato text,
      sede text, zona text, installatore text, installatore_id uuid, clienti_proprietario text,
      clienti_proprietario_id uuid references utenti(id), consenso_contatto_email boolean,
      created_at timestamptz default now(), updated_at timestamptz default now(),
      ora_modifica timestamptz, ora_creazione timestamptz, provincia_indirizzo_postale text,
      importo_contrattuale numeric, lead_id uuid references leads(id));
    grant usage on schema public to authenticated, service_role;
    grant select on utenti to authenticated;
    grant select, insert, update on clienti, leads to authenticated;
    grant all on utenti, clienti, leads to service_role;
    alter table clienti enable row level security;
    create policy own_clients on clienti for select to authenticated
      using (clienti_proprietario_id = nullif(current_setting('test.owner', true), '')::uuid);
  `)
  await db.query('insert into utenti values ($1,$2),($3,$4)', [a, 'Zeta', b, 'Alfa'])
  await db.query(`insert into clienti (nome_clienti, clienti_proprietario_id, ora_modifica, updated_at)
    values ('First',$1,'2026-09-01','2026-09-04'),('Second',$2,null,'2026-09-03')`, [a, b])
  await db.exec(await sqlFile('supabase/migrations/20260904b_clienti_report_sort.sql'))
  check((await rows('select nome_clienti from clienti_report_list order by modifica_visualizzata desc, id'))[0].nome_clienti === 'Second', 'sort uses displayed date, including null fallback')
  check((await rows('select nome_clienti from clienti_report_list order by proprietario_ordinamento, id limit 1 offset 0'))[0].nome_clienti === 'Second', 'sort uses owner name before pagination')
  await db.exec(await sqlFile('supabase/migrations/20260905_clienti_report_list_all_fields.sql'))
  await db.query("update clienti set importo_contrattuale = 28190 where nome_clienti = 'First'")
  check((await rows("select importo_contrattuale from clienti_report_list where nome_clienti = 'First'"))[0].importo_contrattuale === '28190', 'client list view exposes contractual amount')
  await db.exec(`set role authenticated; set test.owner = '${a}';`)
  check((await rows('select id from clienti_report_list')).length === 1, 'view preserves invoker RLS')
  await db.exec('reset role')

  const conversion = await sqlFile('supabase/migrations/20260904c_atomic_lead_conversion.sql')
  await db.exec(conversion)
  await db.exec(conversion)
  const lead = (await rows(`insert into leads (nome_lead, lead_proprietario_id, provincia) values ('Test lead',$1,'Roma') returning id`, [a]))[0].id
  const converted = (await rows('select crm_convert_lead_atomic($1,$2,$3) as id', [lead, [a], [a]]))[0].id
  check((await rows('select account_convertito_id from leads where id=$1', [lead]))[0].account_convertito_id === converted, 'both sides linked')
  await assert.rejects(db.query('select crm_convert_lead_atomic($1,$2,$3)', [lead, [a], [a]]), /gia convertito/); checks++
  check((await rows('select id from clienti where lead_id=$1', [lead])).length === 1, 'retry never duplicates')
  await assert.rejects(db.query('insert into clienti (lead_id) values ($1)', [lead]), /unique/); checks++
  await db.exec('set role authenticated')
  await assert.rejects(db.query('select crm_convert_lead_atomic($1,null,null)', [lead]), /permission denied/); checks++
  await db.exec('reset role')

  const deniedLead = (await rows(`insert into leads (nome_lead, lead_proprietario_id) values ('Denied',$1) returning id`, [b]))[0].id
  await assert.rejects(db.query('select crm_convert_lead_atomic($1,$2,$3)', [deniedLead, [a], [a]]), /fuori perimetro/); checks++
  await assert.rejects(db.query('select crm_convert_lead_atomic($1,$2,$3)', [deniedLead, [b], []]), /fuori perimetro/); checks++
  check((await rows('select id from clienti where lead_id=$1', [deniedLead])).length === 0, 'denied conversion leaves no client')

  const brokenLead = (await rows(`insert into leads (nome_lead, lead_proprietario_id) values ('Broken',$1) returning id`, [a]))[0].id
  await db.exec(`create function fail_conversion_update() returns trigger language plpgsql as $$ begin
    if new.nome_lead = 'Broken' then raise exception 'simulated failure'; end if; return new; end $$;
    create trigger fail_update before update on leads for each row execute function fail_conversion_update();`)
  await assert.rejects(db.query('select crm_convert_lead_atomic($1,null,null)', [brokenLead]), /simulated failure/); checks++
  check((await rows('select id from clienti where lead_id=$1', [brokenLead])).length === 0, 'failure rolls back client insert')
  await db.exec('drop trigger fail_update on leads')

  const orphanLead = (await rows(`insert into leads (nome_lead, lead_proprietario_id) values ('Orphan',$1) returning id`, [a]))[0].id
  const orphanClient = (await rows('insert into clienti (lead_id,clienti_proprietario_id) values ($1,$2) returning id', [orphanLead, a]))[0].id
  check((await rows('select crm_convert_lead_atomic($1,null,null) as id', [orphanLead]))[0].id === orphanClient, 'existing orphan reused instead of duplicated')

  await db.exec(`insert into utenti values (gen_random_uuid(),'Ambiguous'),(gen_random_uuid(),'Ambiguous');
    insert into clienti (nome_clienti,clienti_proprietario) values ('Legacy',' zeta '),('Unknown','Missing'),('Ambiguous','Ambiguous');`)
  const backfill = await sqlFile('scripts/migrations/report-vito-owner-backfill.sql')
  await db.exec(backfill)
  check((await rows("select clienti_proprietario_id from clienti where nome_clienti='Legacy'"))[0].clienti_proprietario_id === null, 'default dry-run does not change data')
  await db.exec(backfill.replace(/rollback;\s*$/, 'commit;'))
  check((await rows("select clienti_proprietario_id from clienti where nome_clienti='Legacy'"))[0].clienti_proprietario_id === a, 'unique normalized name linked')
  check((await rows("select id from clienti where nome_clienti in ('Unknown','Ambiguous') and clienti_proprietario_id is null")).length === 2, 'unknown and ambiguous owners left untouched')
  await db.exec(backfill.replace(/rollback;\s*$/, 'commit;'))
  check((await rows('select * from report_vito_owner_backfill_audit')).length === 1, 'backfill is idempotent and audited')
  const rollback = await sqlFile('scripts/migrations/report-vito-owner-rollback.sql')
  await db.exec(rollback.replace(/rollback;\s*$/, 'commit;'))
  check((await rows("select clienti_proprietario_id from clienti where nome_clienti='Legacy'"))[0].clienti_proprietario_id === null, 'rollback restores the owner association')
  console.log(JSON.stringify({ postgresChecksPassed: checks, productionConnections: 0 }))
} finally { await db.close() }
