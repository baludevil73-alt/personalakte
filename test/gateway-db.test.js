import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Gateway SQL sperrt direkte Zugriffe; Audit und Versionswechsel sind atomar',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.members(user_id uuid primary key,role text);
 create table public.person_files(id uuid primary key default gen_random_uuid(),first_name text,last_name text,notes text,created_by uuid,updated_by uuid,updated_at timestamptz default now(),deleted_at timestamptz);
 create table public.file_documents(id uuid);
 create table public.audit_events(id bigint generated always as identity primary key,actor uuid,file_id uuid,action text not null,details jsonb not null);
 grant all on public.members,public.person_files,public.file_documents,public.audit_events to anon,authenticated;
 grant select(first_name) on public.person_files to authenticated;`);
 await db.exec(await readFile(new URL('../database/discord-gateway.sql',import.meta.url),'utf8'));
 for(const role of ['anon','authenticated']) {
  await db.exec('set role '+role);
  for(const table of ['members','person_files','file_documents','audit_events']) await assert.rejects(db.query('select * from public.'+table));
  await assert.rejects(db.query('select public.nc_gateway_ready()'));
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 assert.equal((await db.query('select public.nc_gateway_ready() as ready')).rows[0].ready,true);
 const row=(await db.query("insert into public.person_files(first_name,created_by,updated_by) values('Test','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001') returning id,updated_at")).rows[0];
 await db.query("update public.person_files set notes='Neu',updated_by='00000000-0000-0000-0000-000000000001' where id=$1",[row.id]);
 await db.exec('reset role');
 assert.equal((await db.query('select * from public.audit_events')).rows.length,2);
 assert.notEqual((await db.query('select updated_at from public.person_files')).rows[0].updated_at,row.updated_at);
 await db.exec('grant select(first_name) on public.person_files to authenticated; set role service_role');
 assert.equal((await db.query('select public.nc_gateway_ready() as ready')).rows[0].ready,false);
 }finally{await db.close();}
});
