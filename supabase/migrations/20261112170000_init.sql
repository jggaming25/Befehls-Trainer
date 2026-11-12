-- ============================================================================
-- Befehlstrainer · Supabase-Schema
-- Ausführen über: supabase db push  (oder im SQL-Editor)
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Profile / Registrierungsanfragen
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_username text not null,
  roblox_username text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_status_idx on public.profiles (status, created_at);
create unique index if not exists profiles_discord_unique on public.profiles (lower(discord_username));

-- ----------------------------------------------------------------------------
-- Hilfsfunktionen
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'approved'
  );
$$;

create or replace function public.bootstrap_needed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles);
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.bootstrap_needed() to anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, update on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- Registrierung: erstes Konto wird automatisch Admin, alle weiteren pending
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discord text := coalesce(new.raw_user_meta_data ->> 'discord_username', '');
  v_roblox  text := coalesce(new.raw_user_meta_data ->> 'roblox_username', '');
  v_first   boolean;
begin
  -- Serialisiert gleichzeitige Registrierungen, damit es genau einen ersten Admin gibt.
  perform pg_advisory_xact_lock(782341);

  select not exists (select 1 from public.profiles) into v_first;

  insert into public.profiles (id, discord_username, roblox_username, role, status, approved_at)
  values (
    new.id,
    nullif(trim(v_discord), ''),
    nullif(trim(v_roblox), ''),
    case when v_first then 'admin' else 'user' end,
    case when v_first then 'approved' else 'pending' end,
    case when v_first then now() else null end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Admin-Aktionen: Anfrage annehmen / ablehnen
-- ----------------------------------------------------------------------------
create or replace function public.approve_request(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;

  update public.profiles
     set status = 'approved',
         rejection_reason = null,
         approved_at = now(),
         approved_by = auth.uid(),
         updated_at = now()
   where id = target
     and id <> auth.uid();
end;
$$;

create or replace function public.reject_request(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;

  update public.profiles
     set status = 'rejected',
         rejection_reason = nullif(trim(reason), ''),
         approved_at = null,
         approved_by = auth.uid(),
         updated_at = now()
   where id = target
     and id <> auth.uid()
     and role <> 'admin';
end;
$$;

grant execute on function public.approve_request(uuid) to authenticated;
grant execute on function public.reject_request(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Befehle (admin-editierbar)
-- ----------------------------------------------------------------------------
create table if not exists public.commands (
  nr text primary key,
  title text not null,
  short text,
  description text,
  template text,
  fields jsonb not null default '[]'::jsonb,
  measures jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commands_fields_array check (jsonb_typeof(fields) = 'array'),
  constraint commands_measures_array check (jsonb_typeof(measures) = 'array')
);

alter table public.commands enable row level security;

drop policy if exists commands_select_approved on public.commands;
create policy commands_select_approved
  on public.commands for select
  to authenticated
  using (public.is_approved());

drop policy if exists commands_admin_write on public.commands;
create policy commands_admin_write
  on public.commands for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.commands to authenticated;

-- ----------------------------------------------------------------------------
-- Situationen (admin-editierbar)
-- ----------------------------------------------------------------------------
create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  command_nr text not null references public.commands (nr) on delete cascade,
  title text not null,
  subtitle text,
  train text,
  time text,
  facts jsonb not null default '[]'::jsonb,
  situation text not null,
  task text,
  radio jsonb not null default '[]'::jsonb,
  field_points jsonb not null default '{}'::jsonb,
  measure_points jsonb not null default '{}'::jsonb,
  explanation text,
  scene jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scenarios_facts_array check (jsonb_typeof(facts) = 'array'),
  constraint scenarios_radio_array check (jsonb_typeof(radio) = 'array'),
  constraint scenarios_scene_object check (jsonb_typeof(scene) = 'object')
);

create index if not exists scenarios_active_idx on public.scenarios (active, created_at desc);
create index if not exists scenarios_command_idx on public.scenarios (command_nr);

alter table public.scenarios enable row level security;

drop policy if exists scenarios_select_approved on public.scenarios;
create policy scenarios_select_approved
  on public.scenarios for select
  to authenticated
  using (public.is_approved());

drop policy if exists scenarios_admin_write on public.scenarios;
create policy scenarios_admin_write
  on public.scenarios for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.scenarios to authenticated;

-- ----------------------------------------------------------------------------
-- updated_at-Trigger
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists commands_touch on public.commands;
create trigger commands_touch before update on public.commands
  for each row execute function public.touch_updated_at();

drop trigger if exists scenarios_touch on public.scenarios;
create trigger scenarios_touch before update on public.scenarios
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime für Admin-Anfragen
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
