-- Erst nach Prüfung des bestehenden Projekts anwenden. Kein Zugriff auf bestehende Tabellen.
begin;
create table public.nc_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor','admin'))
);
alter table public.nc_members enable row level security;
revoke all on public.nc_members from anon, authenticated;
grant select on public.nc_members to authenticated;
create policy member_self on public.nc_members for select to authenticated
  using (user_id = (select auth.uid()));

create table public.nc_records (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  notes text not null default '' check (length(notes) <= 20000),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.nc_records enable row level security;
revoke all on public.nc_records from anon, authenticated;
grant select, delete on public.nc_records to authenticated;
grant insert (name,notes), update (name,notes) on public.nc_records to authenticated;
create policy records_read on public.nc_records for select to authenticated
 using (exists (select 1 from public.nc_members where user_id = (select auth.uid())));
create policy records_insert on public.nc_records for insert to authenticated
 with check (exists (select 1 from public.nc_members where user_id = (select auth.uid()) and role in ('editor','admin')));
create policy records_update on public.nc_records for update to authenticated
 using (exists (select 1 from public.nc_members where user_id = (select auth.uid()) and role in ('editor','admin')))
 with check (exists (select 1 from public.nc_members where user_id = (select auth.uid()) and role in ('editor','admin')));
create policy records_delete on public.nc_records for delete to authenticated
 using (exists (select 1 from public.nc_members where user_id = (select auth.uid()) and role = 'admin'));

create schema nc_private;
revoke all on schema nc_private from public, anon, authenticated;
create table public.nc_audit (
 id bigint generated always as identity primary key,
 actor uuid,
 record_id uuid not null,
 action text not null,
 occurred_at timestamptz not null default clock_timestamp()
);
alter table public.nc_audit enable row level security;
revoke all on public.nc_audit from anon, authenticated;
grant select on public.nc_audit to authenticated;
create policy audit_admin on public.nc_audit for select to authenticated
 using (exists (select 1 from public.nc_members where user_id = (select auth.uid()) and role = 'admin'));
-- Definer nur für das unveränderbare Protokoll, nicht für Aktenzugriff.
create function nc_private.record_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'UPDATE' then new.updated_at := clock_timestamp(); end if;
 insert into public.nc_audit(actor,record_id,action)
 values (auth.uid(),case when tg_op = 'DELETE' then old.id else new.id end,tg_op);
 if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function nc_private.record_change() from public, anon, authenticated;
create trigger nc_record_change before insert or update or delete on public.nc_records
 for each row execute function nc_private.record_change();
commit;
