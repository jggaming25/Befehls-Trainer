-- ============================================================================
-- Bewertung: manuelle Punkte auch in der Einzelauswertung (review) speichern
-- Ohne diese Korrektur blieben Freitext-/Befehlsaufgaben nach der Bewertung in
-- der Einzelauswertung und im Detail-Export auf "offen".
-- ============================================================================

drop function if exists public.grade_quiz_attempt(uuid, jsonb, text, boolean);

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
  v_review jsonb;
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

  -- Einzelauswertung (review) mit den manuellen Punkten aktualisieren.
  select coalesce(jsonb_agg(
    case
      when item ->> 'type' = 'multiple_choice' then item
      else item || jsonb_build_object(
        'manual_points', coalesce((v_out -> (item ->> 'id') ->> 'manual_points')::numeric, 0),
        'points', coalesce((v_out -> (item ->> 'id') ->> 'points')::numeric, 0),
        'graded', true
      )
    end
  ), '[]'::jsonb)
  into v_review
  from jsonb_array_elements(coalesce(v.review, '[]'::jsonb)) as item;

  select discord_username into v_name from public.profiles where id = auth.uid();

  update public.quiz_attempts
     set answers = v_out,
         review = v_review,
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
