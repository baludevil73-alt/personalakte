-- Zusatz zur bereits eingerichteten Discord-Aktenverwaltung. Wiederholbar.
begin;
-- Unabhängig von alten, permissiven Regeln: direkter Storage-Zugriff gesperrt.
drop policy if exists nc_documents_gateway_only on storage.objects;
create policy nc_documents_gateway_only on storage.objects as restrictive
 for all to anon,authenticated
 using (bucket_id <> 'personal-documents')
 with check (bucket_id <> 'personal-documents');
grant select,insert on public.file_documents to service_role;

create or replace function nc_private.document_audit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.audit_events(actor,file_id,action,details)
 values(new.uploaded_by,new.file_id,'INSERT',jsonb_build_object('operation','document_upload','document_id',new.id,'kind',new.kind));
 return new;
end;
$$;
revoke all on function nc_private.document_audit() from public,anon,authenticated;
drop trigger if exists nc_document_audit on public.file_documents;
create trigger nc_document_audit after insert on public.file_documents
 for each row execute function nc_private.document_audit();

create or replace function public.nc_documents_ready() returns boolean
language sql stable security invoker set search_path='' as $$
 select exists (
  select 1 from storage.buckets where id='personal-documents' and public=false
 ) and exists (
  select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='nc_documents_gateway_only' and permissive='RESTRICTIVE'
  and cmd='ALL' and roles @> array['anon','authenticated']::name[]
  and qual='(bucket_id <> ''personal-documents''::text)'
  and with_check='(bucket_id <> ''personal-documents''::text)'
 ) and exists (
  select 1 from pg_trigger where tgrelid='public.file_documents'::regclass
  and tgname='nc_document_audit' and tgenabled='O'
 ) and public.nc_gateway_ready();
$$;
revoke all on function public.nc_documents_ready() from public,anon,authenticated;
grant execute on function public.nc_documents_ready() to service_role;
commit;
