-- ----------------------------------------------------------------------------
-- Konten sofort nutzbar machen
-- Die Anmeldung läuft über den Discord-Namen mit einer intern erzeugten
-- E-Mail-Adresse. Eine echte Bestätigungs-Mail kann es deshalb nicht geben.
-- Dieser Trigger setzt neue Auth-Konten direkt auf "bestätigt", damit die
-- Anmeldung unabhängig von der Dashboard-Einstellung "Confirm email" klappt.
-- ----------------------------------------------------------------------------

create or replace function public.confirm_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = new.id
     and email_confirmed_at is null;
  return new;
end;
$$;

drop trigger if exists confirm_new_auth_user on auth.users;

create trigger confirm_new_auth_user
after insert on auth.users
for each row execute function public.confirm_new_auth_user();

-- Bereits vorhandene, unbestätigte Konten nachziehen.
update auth.users
   set email_confirmed_at = now()
 where email_confirmed_at is null;
