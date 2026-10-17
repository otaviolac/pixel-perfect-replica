
create type public.operational_role as enum ('trainee','membro','gerente','capitao');

create table public.sectors (id smallint primary key, name text not null unique, slug text not null unique);
grant select on public.sectors to authenticated;
grant all on public.sectors to service_role;
alter table public.sectors enable row level security;
create policy "sectors read" on public.sectors for select to authenticated using (true);
insert into public.sectors (id,name,slug) values
(1,'Aerodinâmica','aerodinamica'),(2,'Estabilidade e Controle','estabilidade-controle'),
(3,'Desempenho','desempenho'),(4,'Elétrica','eletrica'),
(5,'Estruturas e Ensaios Estruturais','estruturas'),(6,'Marketing','marketing'),
(7,'Financeiro','financeiro'),(8,'Cargas e Aeroelasticidade','cargas-aeroelasticidade');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', email text not null default '',
  birth_date date, joined_at date, photo_path text, phone text, course text,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.operational_role not null default 'trainee',
  sector_id smallint not null references public.sectors(id),
  updated_at timestamptz not null default now(), updated_by uuid
);
create unique index one_active_manager_per_sector on public.memberships(sector_id) where role = 'gerente';
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;

create table public.admin_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(), granted_by uuid
);
grant select on public.admin_access_grants to authenticated;
grant all on public.admin_access_grants to service_role;
alter table public.admin_access_grants enable row level security;

create table public.role_change_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  old_role public.operational_role, new_role public.operational_role,
  old_sector smallint, new_sector smallint, changed_by uuid,
  changed_at timestamptz not null default now(), via_admin boolean not null default false
);
grant select on public.role_change_history to authenticated;
grant all on public.role_change_history to service_role;
alter table public.role_change_history enable row level security;

create table public.feature_flags (
  key text primary key, label text not null, enabled boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid
);
grant select on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;
alter table public.feature_flags enable row level security;
create policy "flags read" on public.feature_flags for select to authenticated using (true);
insert into public.feature_flags (key,label) values
('tarefas','Tarefas'),('voluntarias','Tarefas voluntárias'),('testes','Testes e ensaios'),
('reunioes','Reuniões'),('agenda','Agenda e chamada'),('compras','Lista de compras'),
('aeronave','Dados da aeronave'),('mural','Mural'),('diario_voo','Diário de Voo'),
('fabricacao','Fabricação'),('problemas','Problemas e não conformidades'),
('memoria','Memória técnica e formação'),('sugestoes','Sugestões'),('marketing','Marketing'),
('patrocinios','Patrocínios'),('mensalidades','Mensalidades');

create table public.team_settings (
  id boolean primary key default true check (id),
  team_name text not null default 'Equipe Aerodesign', logo_path text,
  updated_at timestamptz not null default now()
);
grant select on public.team_settings to authenticated;
grant all on public.team_settings to service_role;
alter table public.team_settings enable row level security;
create policy "settings read" on public.team_settings for select to authenticated using (true);
insert into public.team_settings default values;

create table public.competition_dates (
  id uuid primary key default gen_random_uuid(), name text not null,
  starts_at timestamptz not null, location text, created_by uuid,
  created_at timestamptz not null default now(), archived_at timestamptz
);
grant select, insert, update on public.competition_dates to authenticated;
grant all on public.competition_dates to service_role;
alter table public.competition_dates enable row level security;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid,
  area text not null default 'operacional', action text not null,
  entity text, entity_id text, details jsonb, created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

create or replace function public.is_captain(_uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships m join profiles p on p.id=m.user_id
  where m.user_id=_uid and m.role='capitao' and p.active) $$;
create or replace function public.is_admin(_uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from admin_access_grants a join profiles p on p.id=a.user_id
  where a.user_id=_uid and p.active) $$;
create or replace function public.is_active_member(_uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles where id=_uid and active) $$;

create policy "profiles read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_active_member(auth.uid()));
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "memberships read" on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_active_member(auth.uid()));
create policy "admin grants read" on public.admin_access_grants for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "role history read" on public.role_change_history for select to authenticated using (user_id = auth.uid() or public.is_captain(auth.uid()) or public.is_admin(auth.uid()));
create policy "competition read" on public.competition_dates for select to authenticated using (public.is_active_member(auth.uid()));
create policy "competition captain insert" on public.competition_dates for insert to authenticated with check (public.is_captain(auth.uid()));
create policy "competition captain update" on public.competition_dates for update to authenticated using (public.is_captain(auth.uid()));
create policy "audit read" on public.audit_log for select to authenticated using (public.is_admin(auth.uid()) or (area='operacional' and public.is_captain(auth.uid())));

create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if current_user = 'authenticated' then
    new.active := old.active; new.email := old.email; new.id := old.id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id, email, full_name) values (new.id, new.email, coalesce(new.raw_app_meta_data->>'full_name',''));
  insert into memberships(user_id, role, sector_id) values (new.id,
    coalesce((new.raw_app_meta_data->>'invite_role')::public.operational_role, 'trainee'),
    coalesce((new.raw_app_meta_data->>'invite_sector')::smallint, 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create policy "avatars read members" on storage.objects for select to authenticated using (bucket_id='avatars' and public.is_active_member(auth.uid()));
create policy "avatars own write" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
