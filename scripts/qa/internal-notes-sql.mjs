// PostgreSQL isolato: nessun collegamento al database reale.
// node scripts/qa/internal-notes-sql.mjs <percorso assoluto a pglite/dist/index.js>
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002'
const file = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')
let checks = 0
const check = (value) => { assert.ok(value); checks++ }
try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select current_setting('test.identity')::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create function public.current_utente_id() returns uuid language sql as $$ select auth.uid() $$;
    create table ruoli (id uuid primary key, code text, nome text);
    create table utenti (id uuid primary key, auth_user_id uuid, email text, ruolo text, ruolo_id uuid);
    create table clienti (id uuid primary key);
    insert into utenti values ('${a}','${a}','admin@test.invalid','ADMIN',null), ('${b}','${b}','agent@test.invalid','AGENT',null);
    insert into clienti values ('${a}');
    grant usage on schema public, auth to authenticated;
    grant select on utenti, ruoli, clienti to authenticated;
  `)
  await db.exec(await file('20260827_cliente_note_interne.sql'))
  await db.exec(`insert into cliente_note_interne (cliente_id,contenuto,creato_da) values ('${a}','Nota storica','${a}');`)
  const migration = await file('20260904e_note_interne_menzioni.sql')
  await db.exec(migration)
  await db.exec(migration)
  check((await db.query('select menzioni from cliente_note_interne')).rows[0].menzioni.length === 0)
  await assert.rejects(db.exec(`update cliente_note_interne set menzioni = '{}'::jsonb`), /check constraint/); checks++
  await db.exec(`set role authenticated; set test.identity='${a}';`)
  const mention = [{ userId: a, name: 'Admin', start: 0, end: 6 }]
  await db.query(`update cliente_note_interne set contenuto='@Admin nota',menzioni=$1`, [JSON.stringify(mention)])
  assert.deepEqual((await db.query('select menzioni from cliente_note_interne')).rows[0].menzioni, mention); checks++
  await db.exec(`set test.identity='${b}';`)
  check((await db.query('select * from cliente_note_interne')).rows.length === 0)
  await assert.rejects(db.exec(`insert into cliente_note_interne (cliente_id,contenuto,creato_da,menzioni) values ('${a}','Nota','${b}','[]')`), /row-level security/); checks++
  check((await db.query(`update cliente_note_interne set menzioni='[]' returning id`)).rows.length === 0)
  console.log(`${checks} SQL checks passed: legacy default, repeatability, JSON array, persistence, unchanged RLS.`)
} finally { await db.close() }
