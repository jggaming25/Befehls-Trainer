-- ============================================================================
-- Befehlstrainer · Manuelle Bestehensentscheidung, Daten-Export, Löschen
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Bestehen wird manuell durch einen Admin entschieden
--    Die Prozentgrenze in quiz_settings.pass_percent ist nur noch eine
--    Empfehlung und keine automatische Schwelle mehr.
-- ----------------------------------------------------------------------------
alter table public.quiz_attempts
  add column if not exists passed boolean;

comment on column public.quiz_attempts.passed is
  'Manuelle Bestehensentscheidung durch einen Admin. NULL = noch nicht entschieden.';

-- Alte Signatur (3 Argumente) entfernen, damit es keine Überladung gibt.
drop function if exists public.grade_quiz_attempt(uuid, jsonb, text);

create or replace function public.grade_quiz_attempt(
  p_attempt uuid,
  p_points jsonb,
  p_note text default null,
  p_passed boolean default null
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
         passed = p_passed,
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

grant execute on function public.grade_quiz_attempt(uuid, jsonb, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Einzelne Auswertung / Daten endgültig löschen
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_attempt(p_attempt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;

  delete from public.quiz_attempts where id = p_attempt returning user_id into v_user;
  if v_user is null then
    raise exception 'Versuch nicht gefunden';
  end if;
end;
$$;

grant execute on function public.admin_delete_attempt(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Konto vollständig löschen (auth.users + Profil + alle Daten)
--    profiles.id referenziert auth.users(id) on delete cascade, dadurch werden
--    Profil, Versuche, Antworten und Lösungsschlüssel mitgelöscht.
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_account(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Nicht autorisiert';
  end if;
  if target = auth.uid() then
    raise exception 'Das eigene Konto kann nicht gelöscht werden.';
  end if;

  select * into v_profile from public.profiles where id = target;
  if not found then
    raise exception 'Konto nicht gefunden';
  end if;

  if v_profile.role = 'admin' then
    select count(*) into v_admin_count from public.profiles where role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'Das letzte Admin-Konto kann nicht gelöscht werden.';
    end if;
  end if;

  delete from auth.sessions where user_id = target;
  delete from auth.refresh_tokens where user_id = target::text;

  delete from auth.users where id = target;
  if not found then
    raise exception 'Auth-Konto nicht gefunden';
  end if;

  return jsonb_build_object(
    'id', target,
    'discord_username', v_profile.discord_username
  );
end;
$$;

grant execute on function public.admin_delete_account(uuid) to authenticated;
