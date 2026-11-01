import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Storage-Regeln sperren alte Client-Freigaben und bleiben wiederholbar',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema nc_private;create schema storage;grant usage on schema storage to anon,authenticated,service_role;
 create table storage.buckets(id text,public boolean);grant select on storage.buckets to service_role;
 insert into storage.buckets values('personal-documents',false);
 create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;
 grant all on storage.objects to anon,authenticated;
 create policy old_permissive on storage.objects for all to anon,authenticated using(true) with check(true);
 insert into storage.objects values(gen_random_uuid(),'personal-documents'),(gen_random_uuid(),'unrelated');
 create table public.person_files(id uuid primary key);
 create table public.file_documents(id uuid primary key default gen_random_uuid(),file_id uuid references public.person_files(id),kind text,storage_path text unique,uploaded_by uuid);
 create table public.audit_events(id bigint generated always as identity,actor uuid,file_id uuid,action text not null,details jsonb);
 grant insert on public.audit_events to service_role;grant usage on all sequences in schema public to service_role;
 create function public.nc_gateway_ready() returns boolean language sql as $$select true$$;`);
 const sql=await readFile(new URL('../database/documents-gateway.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  assert.equal((await db.query("select * from storage.objects where bucket_id='personal-documents'")).rows.length,0);
  assert.equal((await db.query("select * from storage.objects where bucket_id='unrelated'")).rows.length,1);
  await assert.rejects(db.query("insert into storage.objects values(gen_random_uuid(),'personal-documents')"));
  await assert.rejects(db.query('select public.nc_documents_ready()'));
  await db.exec('reset role');
 }
 await db.exec('set role service_role');assert.equal((await db.query('select public.nc_documents_ready() ready')).rows[0].ready,true);
 await db.exec('reset role');await db.exec("insert into public.person_files values('00000000-0000-0000-0000-000000000001');set role service_role");
 await db.exec("insert into public.file_documents(file_id,kind,storage_path,uploaded_by) values('00000000-0000-0000-0000-000000000001','identity','random.png','00000000-0000-0000-0000-000000000002')");
 await db.exec('reset role');const rows=(await db.query('select * from public.audit_events')).rows;assert.equal(rows.length,1);assert.equal(rows[0].action,'INSERT');assert.equal(rows[0].details.operation,'document_upload');
 await db.exec("update storage.buckets set public=true;set role service_role");assert.equal((await db.query('select public.nc_documents_ready() ready')).rows[0].ready,false);
 }finally{await db.close();}
});
