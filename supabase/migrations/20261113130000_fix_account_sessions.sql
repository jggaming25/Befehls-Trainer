-- Korrektur: auth.refresh_tokens.user_id ist varchar, nicht uuid.
-- Betroffen waren admin_set_account_status und admin_reset_password.

create or replace function public.admin_set_account_status(target uuid, p_status text, p_reason text default null)
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
