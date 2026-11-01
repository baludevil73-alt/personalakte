-- Bestehendes Schema beibehalten. Direkter Client-Zugriff wird gesperrt.
-- Vor Anwendung bestehende Views, RPCs und Storage separat prüfen.
begin;
revoke all on public.members,public.person_files,public.file_documents,public.audit_events from public,anon,authenticated;
-- Auch etwaige Spaltenrechte entfernen.
do $$
declare r record;
begin
 for r in select table_name,column_name from information_schema.columns
 where table_schema='public' and table_name in ('members','person_files','file_documents','audit_events') loop
 execute format('revoke all (%I) on public.%I from public,anon,authenticated',r.column_name,r.table_name);
 end loop;
end $$;
grant select,insert,update on public.person_files to service_role;
grant insert on public.audit_events to service_role;
grant usage on all sequences in schema public to service_role;
alter table public.members enable row level security;
alter table public.person_files enable row level security;
alter table public.file_documents enable row level security;
alter table public.audit_events enable row level security;

create schema if not exists nc_private;
revoke all on schema nc_private from public,anon,authenticated;
create or replace function nc_private.gateway_audit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.updated_at := clock_timestamp();
 insert into public.audit_events(actor,file_id,action,details)
 values(case when tg_op='INSERT' then new.created_by else new.updated_by end,
 new.id,tg_op,'{}'::jsonb);
 return new;
end;
$$;
revoke all on function nc_private.gateway_audit() from public,anon,authenticated;
create trigger nc_gateway_audit before insert or update on public.person_files
 for each row execute function nc_private.gateway_audit();

create function public.nc_gateway_ready() returns boolean
language sql stable security invoker set search_path='' as $$
 select
 not exists (
  select 1 from (values ('public.members'),('public.person_files'),('public.file_documents'),('public.audit_events')) t(name)
  cross join (values ('anon'),('authenticated')) r(name)
  where has_table_privilege(r.name,t.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_any_column_privilege(r.name,t.name,'SELECT,INSERT,UPDATE,REFERENCES')
 )
 -- Lesbare Views oder aufrufbare Definer-Funktionen könnten den Schutz umgehen.
 and not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('v','m')
  and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'SELECT'))
 )
 and not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
 )
 and exists (select 1 from pg_trigger where tgrelid='public.person_files'::regclass and tgname='nc_gateway_audit' and tgenabled='O');
$$;
revoke all on function public.nc_gateway_ready() from public,anon,authenticated;
grant execute on function public.nc_gateway_ready() to service_role;
commit;
