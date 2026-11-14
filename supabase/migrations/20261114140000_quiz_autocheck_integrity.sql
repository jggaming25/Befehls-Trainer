-- ============================================================================
-- Befehlstrainer · Automatische Prüfung der Befehlsaufgaben, Kopfzeile,
-- Integritätsbestätigung vor Prüfungsbeginn
-- ============================================================================

alter table public.quiz_attempts
  add column if not exists integrity_ack_at timestamptz;

comment on column public.quiz_attempts.integrity_ack_at is
  'Zeitpunkt der Bestätigung des Prüfungshinweises (Betrugsversuch, KI, Hilfsmittel).';

-- ----------------------------------------------------------------------------
-- Hilfsfunktionen
-- ----------------------------------------------------------------------------
create or replace function public.quiz_norm_text(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_text, ''))), '\s+', ' ', 'g');
$$;

create or replace function public.quiz_order_header(p_scenario jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_order jsonb := coalesce(p_scenario -> 'order', '{}'::jsonb);
  v_header jsonb := coalesce(v_order -> 'header', '{}'::jsonb);
  v_train text := coalesce(p_scenario ->> 'train', '');
  v_time text := coalesce(p_scenario ->> 'time', '');
  v_station text := coalesce(v_order ->> 'fdl_station', v_order ->> 'fdlStation', '');
begin
  if not (v_header ? 'A') then
    v_header := v_header || jsonb_build_object('A', v_train);
  end if;
  if not (v_header ? 'B') then
    v_header := v_header || jsonb_build_object('B', coalesce(v_order ->> 'date', ''));
  end if;
  if not (v_header ? 'C') then
    v_header := v_header || jsonb_build_object('C', coalesce(p_scenario ->> 'subtitle', ''));
  end if;
  if not (v_header ? 'D') then
    v_header := v_header || jsonb_build_object(
      'D',
      case when v_station = '' then '' else 'Bf ' || v_station end
    );
  end if;
  if not (v_header ? 'E') then
    v_header := v_header || jsonb_build_object('E', coalesce(v_order ->> 'copies', '1'));
  end if;
  if not (v_header ? 'V') then
    v_header := v_header || jsonb_build_object('V', coalesce(v_order ->> 'tf_name', v_order ->> 'tfName', ''));
  end if;
  if not (v_header ? 'W') then
    v_header := v_header || jsonb_build_object('W', coalesce(v_order ->> 'fdl_name', v_order ->> 'fdlName', ''));
  end if;
  if not (v_header ? 'Y') then
    v_header := v_header || jsonb_build_object('Y', v_time);
  end if;
  if not (v_header ? 'Z') then
    v_header := v_header || jsonb_build_object('Z', coalesce(v_order ->> 'kennung', ''));
  end if;
  return v_header;
end;
$$;

create or replace function public.quiz_header_check(p_answer jsonb, p_expected jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  k text;
  v_given text;
  v_exp text;
  v_ok boolean;
  v_detail jsonb := '[]'::jsonb;
  v_label text;
  v_reason text;
begin
  foreach k in array array['A','B','C','D','E','V','W','Y','Z'] loop
    v_exp := p_expected ->> k;
    continue when v_exp is null or trim(v_exp) = '';
    v_given := coalesce(p_answer ->> k, '');
    case k
      when 'E' then
        v_ok := regexp_replace(v_given, '\D', '', 'g') = regexp_replace(v_exp, '\D', '', 'g')
                and regexp_replace(v_exp, '\D', '', 'g') <> '';
      when 'B' then
        v_ok := public.quiz_norm_text(v_given) = public.quiz_norm_text(v_exp)
             or public.quiz_norm_text(replace(v_given, '-', '.')) = public.quiz_norm_text(replace(v_exp, '-', '.'));
      when 'V' then
        v_ok := public.quiz_norm_text(v_given) = public.quiz_norm_text(v_exp)
             or (length(public.quiz_norm_text(v_exp)) >= 3 and public.quiz_norm_text(v_given) like '%' || public.quiz_norm_text(v_exp) || '%')
             or (length(public.quiz_norm_text(v_given)) >= 3 and public.quiz_norm_text(v_exp) like '%' || public.quiz_norm_text(v_given) || '%');
      when 'W' then
        v_ok := public.quiz_norm_text(v_given) = public.quiz_norm_text(v_exp)
             or (length(public.quiz_norm_text(v_exp)) >= 3 and public.quiz_norm_text(v_given) like '%' || public.quiz_norm_text(v_exp) || '%')
             or (length(public.quiz_norm_text(v_given)) >= 3 and public.quiz_norm_text(v_exp) like '%' || public.quiz_norm_text(v_given) || '%');
      when 'Y' then
        v_ok := (regexp_match(public.quiz_norm_text(v_given), '\d{1,2}[:.]\d{2}')) is not null
                and coalesce((regexp_match(public.quiz_norm_text(v_given), '\d{1,2}[:.]\d{2}'))[1], '') = v_exp;
      else
        v_ok := public.quiz_norm_text(v_given) = public.quiz_norm_text(v_exp);
    end case;
    v_label := case k
      when 'A' then 'A – Zugnummer'
      when 'B' then 'B – Datum'
      when 'C' then 'C – Standort des Zuges'
      when 'D' then 'D – Standort des Anweisenden'
      when 'E' then 'E – Anzahl der Vordrucke'
      when 'V' then 'V – Name Tf'
      when 'W' then 'W – Name Anweisender'
      when 'Y' then 'Y – Uhrzeit'
      when 'Z' then 'Z – Eindeutige Kennung'
      else k
    end;
    v_reason := case k
      when 'A' then 'Die Zugnummer steht in der Tf-Meldung und in der Fdl-Anweisung.'
      when 'B' then 'Das Datum wird vom Fahrdienstleiter angesagt.'
      when 'C' then 'Der Standort des Zuges muss den Ort eindeutig benennen.'
      when 'D' then 'Der Standort des Anweisenden ist die Dienststelle des Fahrdienstleiters.'
      when 'E' then 'Die Anzahl der Vordrucke wird vom Fahrdienstleiter angesagt.'
      when 'V' then 'Der Name des Triebfahrzeugführers steht in der Tf-Meldung.'
      when 'W' then 'Der Name des Anweisenden steht in der Fdl-Anweisung.'
      when 'Y' then 'Die Uhrzeit wird mit Datum und Kennung angesagt.'
      when 'Z' then 'Die eindeutige Kennung verbindet Vordruck und Zugfunkmeldung.'
      else ''
    end;
    v_detail := v_detail || jsonb_build_array(jsonb_build_object(
      'group', 'Kopfzeile',
      'label', v_label,
      'given', nullif(trim(v_given), ''),
      'expected', v_exp,
      'ok', v_ok,
      'points', 0,
      'max', 0,
      'reason', v_reason
    ));
  end loop;
  return v_detail;
end;
$$;

create or replace function public.quiz_command_autocheck(
  p_answer jsonb,
  p_scenario jsonb,
  p_command_nr text,
  p_points numeric
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_answer jsonb := coalesce(p_answer, '{}'::jsonb);
  v_cmd text := coalesce(p_answer ->> 'command', '');
  v_fields jsonb := coalesce(p_scenario -> 'field_points', '{}'::jsonb);
  v_measures jsonb := coalesce(p_scenario -> 'measure_points', '{}'::jsonb);
  v_header jsonb := public.quiz_order_header(p_scenario);
  v_detail jsonb := '[]'::jsonb;
  v_weight numeric := 0;
  v_score numeric := 0;
  v_cmd_ok boolean := false;
  v_total numeric := 0;
  v_got numeric := 0;
  v_item jsonb;
  v_key text;
  v_expected text;
  v_given text;
  v_ok boolean;
  v_measure_max integer := 0;
  v_measure_ok integer := 0;
  v_penalty integer := 0;
  v_header_detail jsonb := '[]'::jsonb;
  v_header_total integer := 0;
  v_header_ok integer := 0;
  v_auto_max numeric := round(coalesce(p_points, 0) * 0.6, 2);
  v_auto numeric;
  v_label text;
begin
  v_cmd_ok := (v_cmd = p_command_nr);
  v_detail := v_detail || jsonb_build_array(jsonb_build_object(
    'group', 'Befehlswahl',
    'label', 'Passender Befehl',
    'given', v_cmd,
    'expected', p_command_nr,
    'ok', v_cmd_ok,
    'points', 0,
    'max', 0,
    'reason', 'Der Befehl muss die Lage betrieblich korrekt auflösen.'
  ));
  v_weight := v_weight + 35;
  if v_cmd_ok then v_score := v_score + 35; end if;

  if v_fields <> '{}'::jsonb then
    v_weight := v_weight + 40;
    v_total := 0;
    v_got := 0;
    for v_key, v_item in select key, value from jsonb_each(v_fields) loop
      v_expected := v_item ->> 'correct';
      v_total := v_total + coalesce((v_item ->> 'points')::numeric, 0);
      v_given := coalesce(v_answer -> 'fields' ->> v_key, '');
      v_ok := public.quiz_norm_text(v_given) = public.quiz_norm_text(v_expected);
      if v_ok then v_got := v_got + coalesce((v_item ->> 'points')::numeric, 0); end if;
      v_label := coalesce(
        (select f ->> 'label'
           from public.commands c,
                jsonb_array_elements(c.fields) f
          where c.nr = p_command_nr
            and f ->> 'id' = v_key
          limit 1),
        v_key
      );
      v_detail := v_detail || jsonb_build_array(jsonb_build_object(
        'group', 'Angaben',
        'label', v_label,
        'given', nullif(v_given, ''),
        'expected', v_expected,
        'ok', v_ok,
        'points', case when v_ok then coalesce((v_item ->> 'points')::numeric, 0) else 0 end,
        'max', coalesce((v_item ->> 'points')::numeric, 0),
        'reason', 'Angabe exakt aus der Fdl-Anweisung übernehmen.'
      ));
    end loop;
    if v_total > 0 then
      v_score := v_score + 40 * v_got / v_total;
    end if;
  end if;

  if v_measures <> '{}'::jsonb then
    v_weight := v_weight + 15;
    for v_key, v_item in select key, value from jsonb_each(v_measures) loop
      if coalesce((v_item ->> 'correct')::boolean, false) then
        v_measure_max := v_measure_max + 1;
        v_ok := coalesce((v_answer -> 'measures' ->> v_key)::boolean, false);
        if v_ok then v_measure_ok := v_measure_ok + 1; end if;
        v_label := coalesce(
          (select m ->> 'label'
             from public.commands c,
                  jsonb_array_elements(c.measures) m
            where c.nr = p_command_nr
              and m ->> 'id' = v_key
            limit 1),
          v_key
        );
        v_detail := v_detail || jsonb_build_array(jsonb_build_object(
          'group', 'Zusatzmaßnahmen',
          'label', v_label,
          'given', case when v_ok then 'angekreuzt' else 'nicht angekreuzt' end,
          'expected', 'ankreuzen',
          'ok', v_ok,
          'points', 0,
          'max', 0,
          'reason', 'Nur die angeordneten Zusatzmaßnahmen ankreuzen.'
        ));
      else
        v_ok := coalesce((v_answer -> 'measures' ->> v_key)::boolean, false);
        if v_ok then
          v_penalty := v_penalty + 1;
          v_label := coalesce(
            (select m ->> 'label'
               from public.commands c,
                    jsonb_array_elements(c.measures) m
              where c.nr = p_command_nr
                and m ->> 'id' = v_key
              limit 1),
            v_key
          );
          v_detail := v_detail || jsonb_build_array(jsonb_build_object(
            'group', 'Zusatzmaßnahmen',
            'label', v_label,
            'given', 'angekreuzt',
            'expected', 'nicht ankreuzen',
            'ok', false,
            'points', 0,
            'max', 0,
            'reason', 'Diese Maßnahme ist nicht angeordnet.'
          ));
        end if;
      end if;
    end loop;
    if v_measure_max > 0 then
      v_score := v_score + 15 * greatest(0, v_measure_ok - v_penalty) / v_measure_max;
    else
      v_weight := v_weight - 15;
    end if;
  end if;

  v_header_detail := public.quiz_header_check(coalesce(v_answer -> 'header', '{}'::jsonb), v_header);
  v_header_total := jsonb_array_length(v_header_detail);
  if v_header_total > 0 then
    select count(*) into v_header_ok
      from jsonb_array_elements(v_header_detail) e
     where (e ->> 'ok')::boolean;
    v_weight := v_weight + 10;
    v_score := v_score + 10 * v_header_ok / v_header_total;
    v_detail := v_detail || v_header_detail;
  end if;

  if v_weight <= 0 then v_weight := 1; end if;
  v_auto := round(v_auto_max * (v_score / v_weight), 2);

  return jsonb_build_object(
    'auto_points', least(v_auto, v_auto_max),
    'auto_max', v_auto_max,
    'manual_max', greatest(0, coalesce(p_points, 0) - v_auto_max),
    'ratio', round(v_score / v_weight, 4),
    'detail', v_detail
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- start_quiz_attempt mit Integritätsbestätigung
-- ----------------------------------------------------------------------------
drop function if exists public.start_quiz_attempt();

create or replace function public.start_quiz_attempt(p_integrity_ack boolean default false)
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

  select *
    into v_active
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

  if not coalesce(p_integrity_ack, false) then
    raise exception 'Bitte bestätige den Prüfungshinweis vor dem Start.';
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
    user_id, questions, time_limit_seconds, deadline_at, max_points, integrity_ack_at
  )
  values (
    v_uid,
    v_questions,
    v_seconds,
    now() + make_interval(secs => v_seconds),
    v_max,
    now()
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

grant execute on function public.start_quiz_attempt(boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- finalize_quiz_attempt mit automatischer Prüfung der Befehlsaufgaben
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
  v_full_scenario jsonb;
  v_command_nr text;
  v_result jsonb;
  v_auto_points numeric;
  v_auto_max numeric;
  v_manual_max numeric;
  v_auto_detail jsonb;
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
    if v_q ->> 'type' = 'multiple_choice' then
      v_value := case
        when jsonb_typeof(v_ans -> 'value') = 'array' then v_ans -> 'value'
        else '[]'::jsonb
      end;
      select * into v_key
        from public.quiz_attempt_keys
       where attempt_id = p_attempt
         and question_id = (v_q ->> 'id')::uuid;
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
        'manual_points', null,
        'earned', v_points,
        'graded', true,
        'auto_detail', null,
        'correct_ids', coalesce(v_key.correct_ids, '[]'::jsonb),
        'options', coalesce(v_q -> 'options', '[]'::jsonb),
        'reference_answer', coalesce(v_key.reference_answer, ''),
        'scenario', coalesce(v_q -> 'scenario', '{}'::jsonb)
      ));
    elsif v_q ->> 'type' = 'command' then
      select * into v_key
        from public.quiz_attempt_keys
       where attempt_id = p_attempt
         and question_id = (v_q ->> 'id')::uuid;
      v_value := case
        when jsonb_typeof(v_ans -> 'value') = 'object' then v_ans -> 'value'
        else '{}'::jsonb
      end;
      select scenario, command_nr
        into v_full_scenario, v_command_nr
        from public.quiz_questions
       where id = (v_q ->> 'id')::uuid;
      v_full_scenario := coalesce(v_full_scenario, v_q -> 'scenario', '{}'::jsonb);
      v_auto_max := round(coalesce((v_q ->> 'points')::numeric, 0) * 0.6, 2);
      v_result := public.quiz_command_autocheck(
        v_value,
        v_full_scenario,
        coalesce(v_command_nr, v_full_scenario ->> 'command'),
        coalesce((v_q ->> 'points')::numeric, 0)
      );
      v_auto_points := coalesce((v_result ->> 'auto_points')::numeric, 0);
      v_manual_max := coalesce((v_result ->> 'manual_max')::numeric, 0);
      v_auto_detail := v_result -> 'detail';
      v_auto := v_auto + v_auto_points;
      v_out := jsonb_set(
        v_out,
        array[v_q ->> 'id'],
        v_ans || jsonb_build_object(
          'auto_points', v_auto_points,
          'auto_max', v_auto_max,
          'manual_max', v_manual_max,
          'manual_points', null,
          'points', v_auto_points,
          'graded', false,
          'auto_detail', v_auto_detail
        ),
        true
      );
      v_review := v_review || jsonb_build_array(jsonb_build_object(
        'id', v_q ->> 'id',
        'prompt', v_q ->> 'prompt',
        'type', v_q ->> 'type',
        'points', (v_q ->> 'points')::numeric,
        'value', v_value,
        'auto_points', v_auto_points,
        'auto_max', v_auto_max,
        'manual_max', v_manual_max,
        'manual_points', null,
        'earned', v_auto_points,
        'graded', false,
        'auto_detail', v_auto_detail,
        'correct_ids', '[]'::jsonb,
        'options', coalesce(v_q -> 'options', '[]'::jsonb),
        'reference_answer', coalesce(v_key.reference_answer, ''),
        'scenario', coalesce(v_q -> 'scenario', '{}'::jsonb)
      ));
      v_manual_count := v_manual_count + 1;
    else
      select * into v_key
        from public.quiz_attempt_keys
       where attempt_id = p_attempt
         and question_id = (v_q ->> 'id')::uuid;
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
        'auto_max', null,
        'manual_max', null,
        'manual_points', null,
        'earned', null,
        'graded', false,
        'auto_detail', null,
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

-- ----------------------------------------------------------------------------
-- grade_quiz_attempt mit automatischem + manuellem Anteil
-- ----------------------------------------------------------------------------
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
  v_auto numeric;
  v_auto_max numeric;
  v_manual_max numeric;
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
    elsif v_q ->> 'type' = 'command' then
      v_auto := coalesce((v_ans ->> 'auto_points')::numeric, 0);
      v_auto_max := coalesce((v_ans ->> 'auto_max')::numeric, round(coalesce((v_q ->> 'points')::numeric, 0) * 0.6, 2));
      v_manual_max := coalesce((v_ans ->> 'manual_max')::numeric, greatest(0, coalesce((v_q ->> 'points')::numeric, 0) - v_auto_max));
      v_points := coalesce(
        (p_points ->> (v_q ->> 'id'))::numeric,
        coalesce((v_ans ->> 'manual_points')::numeric, 0)
      );
      v_points := least(greatest(v_points, 0), v_manual_max);
      v_total := v_total + v_auto + v_points;
      v_manual := v_manual + v_points;
      v_out := jsonb_set(
        v_out,
        array[v_q ->> 'id'],
        v_ans || jsonb_build_object('manual_points', v_points, 'points', v_auto + v_points, 'graded', true),
        true
      );
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

  -- Einzelauswertung aktualisieren.
  select coalesce(jsonb_agg(
    case
      when item ->> 'type' = 'multiple_choice' then item
      when item ->> 'type' = 'command' then item || jsonb_build_object(
        'manual_points', coalesce((v_out -> (item ->> 'id') ->> 'manual_points')::numeric, 0),
        'points', coalesce((v_out -> (item ->> 'id') ->> 'points')::numeric, 0),
        'earned', coalesce((v_out -> (item ->> 'id') ->> 'auto_points')::numeric, 0)
          + coalesce((v_out -> (item ->> 'id') ->> 'manual_points')::numeric, 0),
        'graded', true
      )
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

-- ----------------------------------------------------------------------------
-- Seed-Befehlsfragen mit Vordruck-Kopfzeile und GSM-R-Daten anreichern
-- ----------------------------------------------------------------------------
update public.quiz_questions
set scenario = scenario || jsonb_build_object(
  'order', jsonb_build_object(
    'tf_name', 'Weber',
    'fdl_name', 'Müller',
    'fdl_station', 'Musterstadt',
    'date', '14.11.2026',
    'copies', 1,
    'kennung', 'BT-RE4711-0812',
    'header', jsonb_build_object(
      'A', 'RE 4711',
      'B', '14.11.2026',
      'C', 'Bf Musterstadt · Esig 60A',
      'D', 'Bf Musterstadt',
      'E', '1',
      'V', 'Weber',
      'W', 'Müller',
      'Y', '08:12',
      'Z', 'BT-RE4711-0812'
    ),
    'command_values', jsonb_build_object(
      'signal', 'Esig 60A',
      'stelle', 'Musterstadt',
      'bis', 'ASig 62B'
    ),
    'required_measures', jsonb_build_array('sicht')
  )
)
where type = 'command'
  and position = 150;

update public.quiz_questions
set scenario = scenario || jsonb_build_object(
  'order', jsonb_build_object(
    'tf_name', 'Schneider',
    'fdl_name', 'Wagner',
    'fdl_station', 'Musterstadt',
    'date', '14.11.2026',
    'copies', 1,
    'kennung', 'BT-IC2045-0940',
    'header', jsonb_build_object(
      'A', 'IC 2045',
      'B', '14.11.2026',
      'C', 'Musterstadt – Talheim',
      'D', 'Bf Musterstadt',
      'E', '1',
      'V', 'Schneider',
      'W', 'Wagner',
      'Y', '09:40',
      'Z', 'BT-IC2045-0940'
    ),
    'command_values', jsonb_build_object(
      'speed', '50 km/h',
      'von', 'Esig 60A',
      'bis', 'Esig 70A',
      'grund', '29 – Mängel am Oberbau'
    ),
    'required_measures', jsonb_build_array()
  )
)
where type = 'command'
  and position = 160;