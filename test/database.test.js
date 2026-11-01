import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('PostgreSQL: RLS, Rollen, Manipulation und Protokoll', async()=>{
 const db = new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(await readFile(new URL('../database/setup.sql',import.meta.url),'utf8'));
 const ids = [1,2,3,4].map(n=>`00000000-0000-0000-0000-00000000000${n}`);
 for(const id of ids) await db.query('insert into auth.users values ($1)',[id]);
 for(let n=0;n<3;n++) await db.query('insert into public.nc_members values ($1,$2)',[ids[n],['admin','editor','viewer'][n]]);
 async function as(n) {
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n===null?'':ids[n]]);
   await db.exec(n===null?'set role anon':'set role authenticated');
 }
 await as(null);
 await assert.rejects(db.query('select * from public.nc_records'));
 await as(3);
 assert.equal((await db.query('select * from public.nc_records')).rows.length,0);
 await assert.rejects(db.query("insert into public.nc_records(name) values ('Verboten')"));
 await assert.rejects(db.query("insert into public.nc_members values ($1,'admin')",[ids[3]]));
 await as(0);
 const inserted = (await db.query("insert into public.nc_records(name) values ('Testperson') returning id,updated_at")).rows[0];
 await as(2);
 assert.equal((await db.query('select * from public.nc_records')).rows.length,1);
 await assert.rejects(db.query("insert into public.nc_records(name) values ('Verboten')"));
 assert.equal((await db.query("update public.nc_records set name='Verboten' returning id")).rows.length,0);
 assert.equal((await db.query('delete from public.nc_records returning id')).rows.length,0);
 assert.equal((await db.query('select * from public.nc_audit')).rows.length,0);
 await as(1);
 assert.equal((await db.query("update public.nc_records set notes='Bearbeitet' returning id")).rows.length,1);
 await assert.rejects(db.query("update public.nc_records set updated_at=now()"));
 await assert.rejects(db.query("update public.nc_members set role='admin'"));
 assert.equal((await db.query('delete from public.nc_records returning id')).rows.length,0);
 await as(0);
 assert.equal((await db.query('select * from public.nc_audit')).rows.length,2);
 assert.equal((await db.query('update public.nc_records set notes=$1 where id=$2 and updated_at=$3 returning id',['Stale',inserted.id,inserted.updated_at])).rows.length,0);
 await assert.rejects(db.query("update public.nc_audit set action='FAKE'"));
 // Entzug gilt sofort auch mit unverändertem JWT.
 await db.exec('reset role');
 await db.query('delete from public.nc_members where user_id=$1',[ids[1]]);
 await as(1);
 assert.equal((await db.query('select * from public.nc_records')).rows.length,0);
 await as(0);
 assert.equal((await db.query('delete from public.nc_records returning id')).rows.length,1);
 assert.equal((await db.query('select * from public.nc_audit')).rows.length,3);
 } finally { await db.close(); }
});
