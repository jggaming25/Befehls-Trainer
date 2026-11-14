-- ============================================================================
-- Befehlstrainer · Quiz, Bewertung und Kontoverwaltung
-- Ergänzt Profile um Sperr-/Prüfungsfelder, legt Quizfragen, Einstellungen,
-- Versuche und Bewertungen an und stellt die RPCs für den Ablauf bereit.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profile erweitern
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected', 'disabled'));

alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists quiz_required boolean not null default false,
  add column if not exists quiz_required_at timestamptz,
  add column if not exists quiz_deadline timestamptz,
  add column if not exists quiz_required_note text,
  add column if not exists extra_attempts integer not null default 0,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text;

alter table public.profiles drop constraint if exists profiles_extra_attempts_check;
alter table public.profiles
  add constraint profiles_extra_attempts_check check (extra_attempts >= 0);

-- ----------------------------------------------------------------------------
-- Quiz-Einstellungen (genau eine Zeile)
-- ----------------------------------------------------------------------------
create table if not exists public.quiz_settings (
  id boolean primary key default true,
  quiz_enabled boolean not null default true,
  short_minutes numeric(6, 2) not null default 1.5,
  long_minutes numeric(6, 2) not null default 4,
  mc_1_4_minutes numeric(6, 2) not null default 0.5,
  mc_5_10_minutes numeric(6, 2) not null default 1,
  mc_11_plus_minutes numeric(6, 2) not null default 2,
  total_minutes integer,
  pass_percent integer not null default 60,
  retention_weeks integer not null default 12,
  updated_at timestamptz not null default now(),
  constraint quiz_settings_single_row check (id),
  constraint quiz_settings_pass_check check (pass_percent between 0 and 100),
  constraint quiz_settings_retention_check check (retention_weeks between 1 and 52)
);

insert into public.quiz_settings (id) values (true)
on conflict (id) do nothing;

alter table public.quiz_settings enable row level security;

drop policy if exists quiz_settings_read on public.quiz_settings;
create policy quiz_settings_read
  on public.quiz_settings for select
  to authenticated
  using (public.is_approved());

drop policy if exists quiz_settings_admin on public.quiz_settings;
create policy quiz_settings_admin
  on public.quiz_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.quiz_settings to authenticated;
grant insert, update, delete on public.quiz_settings to authenticated;

-- ----------------------------------------------------------------------------
-- Quizfragen
-- ----------------------------------------------------------------------------
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  category text not null default 'regelwerk'
    check (category in ('regelwerk', 'befehl', 'allgemein')),
  type text not null default 'multiple_choice'
    check (type in ('multiple_choice', 'short', 'long', 'command')),
  prompt text not null,
  help text,
  points numeric(6, 2) not null default 2,
  options jsonb not null default '[]'::jsonb,
  reference_answer text,
  scenario jsonb not null default '{}'::jsonb,
  command_nr text references public.commands (nr) on delete set null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_options_array check (jsonb_typeof(options) = 'array'),
  constraint quiz_questions_scenario_object check (jsonb_typeof(scenario) = 'object'),
  constraint quiz_questions_points_check check (points > 0)
);

create index if not exists quiz_questions_active_idx
  on public.quiz_questions (active, category, position);

alter table public.quiz_questions enable row level security;

-- Lesen der vollständigen Frage (inkl. Lösungen) nur über die Admin-View.
drop policy if exists quiz_questions_admin on public.quiz_questions;
create policy quiz_questions_admin
  on public.quiz_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Normale Nutzer dürfen nur die unkritischen Spalten lesen.
revoke all on public.quiz_questions from authenticated;
grant select (id, position, category, type, prompt, help, points, command_nr, active, created_at, updated_at)
  on public.quiz_questions to authenticated;
grant insert, update, delete on public.quiz_questions to authenticated;

-- Öffentliche Sicht ohne Lösungsdaten.
create or replace function public.quiz_public_options(p_options jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', x.o ->> 'id', 'label', x.o ->> 'label')
      order by x.ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) with ordinality as x(o, ord);
$$;

create or replace function public.quiz_public_scenario(p_scenario jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(p_scenario, '{}'::jsonb)
    - 'field_points'
    - 'measure_points'
    - 'explanation'
    - 'source'
    - 'id'
    - 'active';
$$;

drop view if exists public.quiz_questions_public;
create view public.quiz_questions_public
with (security_invoker = false) as
select
  q.id,
  q.position,
  q.category,
  q.type,
  q.prompt,
  coalesce(q.help, '') as help,
  q.points,
  q.command_nr,
  public.quiz_public_options(q.options) as options,
  public.quiz_public_scenario(q.scenario) as scenario
from public.quiz_questions q
where q.active;

grant select on public.quiz_questions_public to authenticated;

-- Admin-Sicht mit vollständigen Lösungen; liefert Nicht-Admins keine Zeilen.
drop view if exists public.quiz_questions_admin;
create view public.quiz_questions_admin
with (security_invoker = false) as
select q.*
from public.quiz_questions q
where public.is_admin();

grant select on public.quiz_questions_admin to authenticated;

-- ----------------------------------------------------------------------------
-- Quiz-Versuche
-- ----------------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'submitted', 'graded', 'expired')),
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  review jsonb not null default '[]'::jsonb,
  time_limit_seconds integer not null default 3600,
  deadline_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_by_name text,
  grading_note text,
  auto_points numeric(8, 2) not null default 0,
  manual_points numeric(8, 2) not null default 0,
  total_points numeric(8, 2) not null default 0,
  max_points numeric(8, 2) not null default 0,
  percentage numeric(6, 2),
  flag text,
  flag_note text,
  flagged_at timestamptz,
  retention_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_idx
  on public.quiz_attempts (user_id, started_at desc);
create index if not exists quiz_attempts_status_idx
  on public.quiz_attempts (status, submitted_at);

alter table public.quiz_attempts enable row level security;

drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select
  on public.quiz_attempts for select
  to authenticated
  using (
    public.is_admin()
    or (
      user_id = auth.uid()
      and (retention_until is null or retention_until > now())
    )
  );

grant select on public.quiz_attempts to authenticated;

-- Lösungen/Erwartungen getrennt und nur für Admins lesbar.
create table if not exists public.quiz_attempt_keys (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null,
  correct_ids jsonb not null default '[]'::jsonb,
  reference_answer text,
  primary key (attempt_id, question_id)
);

alter table public.quiz_attempt_keys enable row level security;

drop policy if exists quiz_attempt_keys_admin on public.quiz_attempt_keys;
create policy quiz_attempt_keys_admin
  on public.quiz_attempt_keys for select
  to authenticated
  using (public.is_admin());

grant select on public.quiz_attempt_keys to authenticated;

-- ----------------------------------------------------------------------------
-- Zeitberechnung
-- ----------------------------------------------------------------------------
create or replace function public.quiz_question_seconds(q_type text, option_count integer)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.quiz_settings%rowtype;
  n integer;
begin
  select * into s from public.quiz_settings where id = true;
  if not found then
    return 60;
  end if;
  if q_type = 'short' then
    n := round(s.short_minutes * 60);
  elsif q_type = 'long' then
    n := round(s.long_minutes * 60);
  elsif q_type = 'command' then
    n := round(s.long_minutes * 120);
  elsif q_type = 'multiple_choice' then
    if coalesce(option_count, 0) <= 4 then
      n := round(s.mc_1_4_minutes * 60);
    elsif coalesce(option_count, 0) <= 10 then
      n := round(s.mc_5_10_minutes * 60);
    else
      n := round(s.mc_11_plus_minutes * 60);
    end if;
  else
    n := 60;
  end if;
  return greatest(coalesce(n, 60), 10);
end;
$$;

revoke all on function public.quiz_question_seconds(text, integer) from public;

-- ----------------------------------------------------------------------------
-- Versuch starten
-- ----------------------------------------------------------------------------
create or replace function public.start_quiz_attempt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_settings public.quiz_settings%rowtype;
  v_active public.quiz_attempts%rowtype;
  v_attempt public.quiz_attempts%rowtype;
  v_used integer;
  v_allowed integer;
  v_questions jsonb := '[]'::jsonb;
  v_seconds integer := 0;
  v_max numeric := 0;
  v_q jsonb;
  v_opt_count integer;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.status <> 'approved' then
    raise exception 'Konto ist nicht freigegeben';
  end if;

  select * into v_settings from public.quiz_settings where id = true;
  if not found or not v_settings.quiz_enabled then
    raise exception 'Das Quiz ist derzeit nicht verfügbar.';
  end if;

  select * into v_active
    from public.quiz_attempts
   where user_id = v_uid
     and status = 'active'
   order by started_at desc
   limit 1;

  if found then
    if now() <= v_active.deadline_at then
      return jsonb_build_object('attempt', to_jsonb(v_active), 'resumed', true);
    end if;
    perform public.finalize_quiz_attempt(v_active.id, 'deadline', 'Zeit abgelaufen');
  end if;

  select count(*) into v_used from public.quiz_attempts where user_id = v_uid;
  v_allowed := 1 + coalesce(v_profile.extra_attempts, 0);
  if v_used >= v_allowed then
    raise exception 'Kein Quiz-Versuch mehr frei. Bitte wende dich an einen Admin.';
  end if;

  select coalesce(jsonb_agg(x.q order by x.grp, x.pos), '[]'::jsonb)
    into v_questions
    from (
      select 0 as grp, q.position as pos,
             jsonb_build_object(
               'id', q.id,
               'position', q.position,
               'category', q.category,
               'type', q.type,
               'prompt', q.prompt,
               'help', coalesce(q.help, ''),
               'points', q.points,
               'options', public.quiz_public_options(q.options),
               'scenario', public.quiz_public_scenario(q.scenario),
               'command_nr', q.command_nr
             ) as q
        from public.quiz_questions q
       where q.active
         and q.category <> 'befehl'
      union all
      select 1 as grp, c.position as pos,
             jsonb_build_object(
               'id', c.id,
               'position', c.position,
               'category', c.category,
               'type', c.type,
               'prompt', c.prompt,
               'help', coalesce(c.help, ''),
               'points', c.points,
               'options', public.quiz_public_options(c.options),
               'scenario', public.quiz_public_scenario(c.scenario),
               'command_nr', c.command_nr
             ) as q
        from (
          select *
            from public.quiz_questions
           where active
             and category = 'befehl'
           order by random()
           limit 2
        ) c
    ) x;

  if jsonb_array_length(v_questions) = 0 then
    raise exception 'Es sind noch keine Quizfragen angelegt.';
  end if;

  for v_q in select value from jsonb_array_elements(v_questions) loop
    v_opt_count := jsonb_array_length(coalesce(v_q -> 'options', '[]'::jsonb));
    v_seconds := v_seconds + public.quiz_question_seconds(v_q ->> 'type', v_opt_count);
    v_max := v_max + coalesce((v_q ->> 'points')::numeric, 0);
  end loop;

  if v_settings.total_minutes is not null then
    v_seconds := greatest(v_settings.total_minutes * 60, 60);
  end if;

  insert into public.quiz_attempts (
    user_id, questions, time_limit_seconds, deadline_at, max_points
  )
  values (
    v_uid,
    v_questions,
    v_seconds,
    now() + make_interval(secs => v_seconds),
    v_max
  )
  returning * into v_attempt;

  insert into public.quiz_attempt_keys (attempt_id, question_id, correct_ids, reference_answer)
  select
    v_attempt.id,
    q.id,
    coalesce((
      select jsonb_agg(o ->> 'id')
        from jsonb_array_elements(coalesce(q.options, '[]'::jsonb)) o
       where coalesce((o ->> 'correct')::boolean, false)
    ), '[]'::jsonb),
    coalesce(q.reference_answer, q.scenario ->> 'explanation', '')
  from public.quiz_questions q
  where q.id in (
    select (x ->> 'id')::uuid from jsonb_array_elements(v_questions) x
  );

  return jsonb_build_object('attempt', to_jsonb(v_attempt), 'resumed', false);
end;
$$;

grant execute on function public.start_quiz_attempt() to authenticated;

-- ----------------------------------------------------------------------------
-- Antwort speichern
-- ----------------------------------------------------------------------------
create or replace function public.save_quiz_answer(
  p_attempt uuid,
  p_question uuid,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt;
  if not found or v_attempt.user_id <> v_uid then
    raise exception 'Versuch nicht gefunden';
  end if;
  if v_attempt.status <> 'active' then
    raise exception 'Dieser Versuch ist bereits abgeschlossen.';
  end if;
  if now() > v_attempt.deadline_at then
    perform public.finalize_quiz_attempt(p_attempt, 'deadline', 'Zeit abgelaufen');
    raise exception 'Die Zeit ist abgelaufen.';
  end if;
  if pg_column_size(p_value) > 20000 then
    raise exception 'Antwort ist zu groß.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_attempt.questions) q
     where q ->> 'id' = p_question::text
  ) then
    raise exception 'Frage gehört nicht zu diesem Versuch.';
  end if;

  update public.quiz_attempts
     set answers = jsonb_set(
       coalesce(answers, '{}'::jsonb),
       array[p_question::text],
       jsonb_build_object('value', p_value, 'saved_at', now()),
       true
     )
   where id = p_attempt;
end;
$$;

grant execute on function public.save_quiz_answer(uuid, uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Versuch abschließen / automatisch bewerten
-- ----------------------------------------------------------------------------
create or replace function public.finalize_quiz_attempt(
  p_attempt uuid,
  p_flag text default null,
  p_note text default null
)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.quiz_attempts%rowtype;
  v_q jsonb;
  v_key public.quiz_attempt_keys%rowtype;
  v_ans jsonb;
  v_value jsonb;
  v_out jsonb;
  v_review jsonb := '[]'::jsonb;
  v_auto numeric := 0;
  v_manual_count integer := 0;
  v_points numeric;
  v_total numeric;
  v_status text;
  v_retention integer := 12;
begin
  select * into v from public.quiz_attempts where id = p_attempt for update;
  if not found then
    return null;
  end if;
  if v.status <> 'active' then
    return v;
  end if;

  select coalesce(retention_weeks, 12) into v_retention
    from public.quiz_settings where id = true;

  v_out := coalesce(v.answers, '{}'::jsonb);

  for v_q in select value from jsonb_array_elements(v.questions) loop
    v_ans := coalesce(v_out -> (v_q ->> 'id'), '{}'::jsonb);
    select * into v_key
      from public.quiz_attempt_keys
     where attempt_id = p_attempt
       and question_id = (v_q ->> 'id')::uuid;

    if v_q ->> 'type' = 'multiple_choice' then
      v_value := case
        when jsonb_typeof(v_ans -> 'value') = 'array' then v_ans -> 'value'
        else '[]'::jsonb
      end;
      v_points := case
        when v_value @> coalesce(v_key.correct_ids, '[]'::jsonb)
         and coalesce(v_key.correct_ids, '[]'::jsonb) @> v_value
        then coalesce((v_q ->> 'points')::numeric, 0)
        else 0
      end;
      v_auto := v_auto + v_points;
      v_out := jsonb_set(
        v_out,
        array[v_q ->> 'id'],
        v_ans || jsonb_build_object('auto_points', v_points, 'points', v_points, 'graded', true),
        true
      );
      v_review := v_review || jsonb_build_array(jsonb_build_object(
        'id', v_q ->> 'id',
        'prompt', v_q ->> 'prompt',
        'type', v_q ->> 'type',
        'points', (v_q ->> 'points')::numeric,
        'value', v_value,
        'auto_points', v_points,
        'correct_ids', coalesce(v_key.correct_ids, '[]'::jsonb),
        'options', coalesce(v_q -> 'options', '[]'::jsonb),
        'reference_answer', coalesce(v_key.reference_answer, ''),
        'scenario', coalesce(v_q -> 'scenario', '{}'::jsonb)
      ));
    else
      v_manual_count := v_manual_count + 1;
      v_out := jsonb_set(
        v_out,
        array[v_q ->> 'id'],
        v_ans || jsonb_build_object('manual_points', null, 'points', null, 'graded', false),
        true
      );
      v_review := v_review || jsonb_build_array(jsonb_build_object(
        'id', v_q ->> 'id',
        'prompt', v_q ->> 'prompt',
        'type', v_q ->> 'type',
        'points', (v_q ->> 'points')::numeric,
        'value', coalesce(v_ans -> 'value', 'null'::jsonb),
        'auto_points', null,
        'correct_ids', '[]'::jsonb,
        'options', coalesce(v_q -> 'options', '[]'::jsonb),
        'reference_answer', coalesce(v_key.reference_answer, ''),
        'scenario', coalesce(v_q -> 'scenario', '{}'::jsonb)
      ));
    end if;
  end loop;

  v_total := v_auto;
  v_status := case when v_manual_count > 0 then 'submitted' else 'graded' end;

  update public.quiz_attempts
     set answers = v_out,
         review = v_review,
         auto_points = v_auto,
         manual_points = 0,
         total_points = v_total,
         percentage = case
           when coalesce(max_points, 0) > 0 then round(v_total / max_points * 100, 2)
           else 0
         end,
         status = v_status,
         submitted_at = now(),
         graded_at = case when v_status = 'graded' then now() else null end,
         graded_by = null,
         graded_by_name = case when v_status = 'graded' then 'Automatisch' else null end,
         retention_until = case
           when v_status = 'graded' then now() + make_interval(weeks => v_retention)
           else null
         end,
         flag = coalesce(p_flag, flag),
         flag_note = coalesce(p_note, flag_note),
         flagged_at = case when p_flag is not null then now() else flagged_at end
   where id = p_attempt
  returning * into v;

  return v;
end;
$$;

revoke all on function public.finalize_quiz_attempt(uuid, text, text) from public;

create or replace function public.submit_quiz_attempt(
  p_attempt uuid,
  p_flag text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v public.quiz_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  select * into v from public.quiz_attempts where id = p_attempt;
  if not found or v.user_id <> v_uid then
    raise exception 'Versuch nicht gefunden';
  end if;
  if v.status = 'active' then
    v := public.finalize_quiz_attempt(p_attempt, p_flag, p_note);
  end if;
  return to_jsonb(v);
end;
$$;

grant execute on function public.submit_quiz_attempt(uuid, text, text) to authenticated;

create or replace function public.flag_quiz_attempt(
  p_attempt uuid,
  p_flag text default 'left',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v public.quiz_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  select * into v from public.quiz_attempts where id = p_attempt;
  if not found or v.user_id <> v_uid then
    raise exception 'Versuch nicht gefunden';
  end if;
  if v.status = 'active' then
    v := public.finalize_quiz_attempt(p_attempt, p_flag, p_note);
  end if;
  return to_jsonb(v);
end;
$$;

grant execute on function public.flag_quiz_attempt(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Manuelle Bewertung
-- ----------------------------------------------------------------------------
create or replace function public.grade_quiz_attempt(
  p_attempt uuid,
  p_points jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.quiz_attempts%rowtype;
  v_q jsonb;
  v_ans jsonb;
  v_out jsonb;
  v_points numeric;
  v_total numeric := 0;
  v_manual numeric := 0;
  v_retention integer := 12;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;

  select * into v from public.quiz_attempts where id = p_attempt for update;
  if not found then
    raise exception 'Versuch nicht gefunden';
  end if;
  if v.status not in ('submitted', 'graded') then
    raise exception 'Dieser Versuch ist noch nicht abgegeben.';
  end if;

  select coalesce(retention_weeks, 12) into v_retention
    from public.quiz_settings where id = true;

  v_out := coalesce(v.answers, '{}'::jsonb);

  for v_q in select value from jsonb_array_elements(v.questions) loop
    v_ans := coalesce(v_out -> (v_q ->> 'id'), '{}'::jsonb);
    if v_q ->> 'type' = 'multiple_choice' then
      v_total := v_total + coalesce((v_ans ->> 'auto_points')::numeric, 0);
    else
      v_points := coalesce(
        (p_points ->> (v_q ->> 'id'))::numeric,
        coalesce((v_ans ->> 'manual_points')::numeric, 0)
      );
      v_points := least(greatest(v_points, 0), coalesce((v_q ->> 'points')::numeric, 0));
      v_total := v_total + v_points;
      v_manual := v_manual + v_points;
      v_out := jsonb_set(
        v_out,
        array[v_q ->> 'id'],
        v_ans || jsonb_build_object('manual_points', v_points, 'points', v_points, 'graded', true),
        true
      );
    end if;
  end loop;

  select discord_username into v_name from public.profiles where id = auth.uid();

  update public.quiz_attempts
     set answers = v_out,
         manual_points = v_manual,
         total_points = v_total,
         percentage = case
           when coalesce(max_points, 0) > 0 then round(v_total / max_points * 100, 2)
           else 0
         end,
         status = 'graded',
         graded_at = now(),
         graded_by = auth.uid(),
         graded_by_name = coalesce(v_name, 'Admin'),
         grading_note = nullif(trim(p_note), ''),
         retention_until = now() + make_interval(weeks => v_retention),
         submitted_at = coalesce(submitted_at, now())
   where id = p_attempt
  returning * into v;

  return to_jsonb(v);
end;
$$;

grant execute on function public.grade_quiz_attempt(uuid, jsonb, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Kontoverwaltung
-- ----------------------------------------------------------------------------
create or replace function public.grant_quiz_attempt(target uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;
  if exists (
    select 1 from public.quiz_attempts
     where user_id = target and status = 'active'
  ) then
    raise exception 'Es läuft noch ein aktiver Versuch. Erst abschließen, dann einen weiteren Versuch freigeben.';
  end if;

  update public.profiles
     set extra_attempts = extra_attempts + 1,
         updated_at = now()
   where id = target
  returning extra_attempts into v_count;

  if v_count is null then
    raise exception 'Konto nicht gefunden';
  end if;
  return v_count;
end;
$$;

grant execute on function public.grant_quiz_attempt(uuid) to authenticated;

create or replace function public.set_quiz_requirement(
  target uuid,
  p_required boolean,
  p_deadline timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;

  update public.profiles
     set quiz_required = p_required,
         quiz_required_at = case
           when p_required and not quiz_required then now()
           when p_required then coalesce(quiz_required_at, now())
           else null
         end,
         quiz_deadline = case when p_required then p_deadline else null end,
         quiz_required_note = case when p_required then nullif(trim(p_note), '') else null end,
         updated_at = now()
   where id = target
  returning * into v;

  if not found then
    raise exception 'Konto nicht gefunden';
  end if;
  return to_jsonb(v);
end;
$$;

grant execute on function public.set_quiz_requirement(uuid, boolean, timestamptz, text) to authenticated;

create or replace function public.admin_set_account_status(
  target uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;
  if target = auth.uid() then
    raise exception 'Das eigene Konto kann nicht deaktiviert werden.';
  end if;
  if p_status not in ('approved', 'disabled') then
    raise exception 'Unbekannter Kontostatus';
  end if;

  update public.profiles
     set status = p_status,
         disabled_at = case when p_status = 'disabled' then now() else null end,
         disabled_reason = case when p_status = 'disabled' then nullif(trim(p_reason), '') else null end,
         updated_at = now()
   where id = target
  returning * into v;

  if not found then
    raise exception 'Konto nicht gefunden';
  end if;

  if p_status = 'disabled' then
    delete from auth.sessions where user_id = target;
    delete from auth.refresh_tokens where user_id = target::text;
  end if;

  return to_jsonb(v);
end;
$$;

grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;

create or replace function public.admin_reset_password(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_otp text := '';
  i integer;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;
  if target = auth.uid() then
    raise exception 'Das eigene Passwort bitte über die normale Passwortänderung setzen.';
  end if;

  select * into v_profile from public.profiles where id = target;
  if not found then
    raise exception 'Konto nicht gefunden';
  end if;

  for i in 1..8 loop
    v_otp := v_otp || substr(
      v_alphabet,
      1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(v_alphabet)),
      1
    );
    if i = 4 then
      v_otp := v_otp || '-';
    end if;
  end loop;

  update auth.users
     set encrypted_password = extensions.crypt(v_otp, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target;

  delete from auth.sessions where user_id = target;
  delete from auth.refresh_tokens where user_id = target::text;

  update public.profiles
     set must_change_password = true,
         updated_at = now()
   where id = target
  returning * into v_profile;

  return jsonb_build_object(
    'discord_username', v_profile.discord_username,
    'roblox_username', v_profile.roblox_username,
    'one_time_password', v_otp,
    'site_url', 'https://jggaming25.github.io/Befehls-Trainer/'
  );
end;
$$;

grant execute on function public.admin_reset_password(uuid) to authenticated;

create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  update public.profiles
     set must_change_password = false,
         updated_at = now()
   where id = auth.uid();
end;
$$;

grant execute on function public.complete_password_change() to authenticated;

-- ----------------------------------------------------------------------------
-- Aufräumen: 12-Wochen-Aufbewahrung und hängende Versuche
-- ----------------------------------------------------------------------------
create or replace function public.prune_quiz_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.quiz_attempts
     where status = 'active'
       and started_at + make_interval(secs => time_limit_seconds) < now() - interval '1 hour'
  loop
    perform public.finalize_quiz_attempt(r.id, 'deadline', 'Zeit abgelaufen');
  end loop;

  delete from public.quiz_attempts
   where retention_until is not null
     and retention_until < now();
end;
$$;

grant execute on function public.prune_quiz_attempts() to authenticated;

-- ----------------------------------------------------------------------------
-- updated_at-Trigger
-- ----------------------------------------------------------------------------
drop trigger if exists quiz_settings_touch on public.quiz_settings;
create trigger quiz_settings_touch before update on public.quiz_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists quiz_questions_touch on public.quiz_questions;
create trigger quiz_questions_touch before update on public.quiz_questions
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime für Bewertungen/Anfragen
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_attempts'
  ) then
    alter publication supabase_realtime add table public.quiz_attempts;
  end if;
end;
$$;
