-- W3 Configuración · 01 Usuarios y legajo del personal (DF-C1 §3, §4.1; R17, R21, R23-R28, R39, R40, R79)
-- Aditivo: columnas nullable, funciones nuevas, trigger de auditoría y FK en RESTRICT.

-- Legajo del personal. W1a también agrega matricula: por eso "if not exists".
alter table public.profiles
  add column if not exists especialidad public.specialty,
  add column if not exists dni text,
  add column if not exists matricula text,
  add column if not exists telefono text,
  add column if not exists email_contacto text,
  add column if not exists fecha_ingreso date,
  add column if not exists fecha_baja date;

-- Último acceso: lo escribe la propia persona al ingresar (no hay otra forma de tocar profiles).
create or replace function public.touch_last_login() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid() and active is not false;
$$;
revoke execute on function public.touch_last_login() from public, anon;
grant execute on function public.touch_last_login() to authenticated;

-- Cambiar el rol de una persona (solo Administración; no el propio ni el rol retirado).
create or replace function public.admin_set_role(p_id uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración cambia roles.';
  end if;
  if p_role = 'medico_coordinador' then
    raise exception 'Ese rol está retirado de la plataforma.';
  end if;
  if p_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol: pedile a otra persona de Administración.';
  end if;
  update public.profiles set role = p_role where id = p_id;
  if not found then raise exception 'No encontramos a esa persona.'; end if;
end $$;
revoke execute on function public.admin_set_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

-- Desactivar o reactivar una cuenta (baja lógica, nunca se borra). Corta el acceso en la base
-- al instante porque get_current_app_role() devuelve null para cuentas inactivas.
create or replace function public.admin_set_active(p_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración activa o desactiva usuarios.';
  end if;
  if p_id = auth.uid() and not p_active then
    raise exception 'No podés desactivar tu propia cuenta: pedile a otra persona de Administración.';
  end if;
  update public.profiles
     set active = p_active,
         fecha_baja = case when p_active then null else coalesce(fecha_baja, (now() at time zone 'America/Argentina/San_Juan')::date) end
   where id = p_id;
  if not found then raise exception 'No encontramos a esa persona.'; end if;
end $$;
revoke execute on function public.admin_set_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;

-- Legajo: lo carga Administración (supuesto a validar con el cliente).
create or replace function public.admin_update_legajo(
  p_id uuid, p_full_name text, p_especialidad public.specialty, p_dni text, p_matricula text,
  p_telefono text, p_email_contacto text, p_fecha_ingreso date, p_fecha_baja date
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración carga el legajo del personal.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Falta el nombre.'; end if;
  update public.profiles set
    full_name = trim(p_full_name), especialidad = p_especialidad,
    dni = nullif(trim(p_dni), ''), matricula = nullif(trim(p_matricula), ''),
    telefono = nullif(trim(p_telefono), ''), email_contacto = nullif(trim(p_email_contacto), ''),
    fecha_ingreso = p_fecha_ingreso, fecha_baja = p_fecha_baja
  where id = p_id;
  if not found then raise exception 'No encontramos a esa persona.'; end if;
end $$;
revoke execute on function public.admin_update_legajo(uuid, text, public.specialty, text, text, text, text, date, date) from public, anon;
grant execute on function public.admin_update_legajo(uuid, text, public.specialty, text, text, text, text, date, date) to authenticated;

-- Auditoría de profiles: igual que fn_audit_log pero sin registrar cada ingreso (solo cambia last_login_at).
create or replace function public.fn_audit_log_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'last_login_at') = (to_jsonb(old) - 'last_login_at') then
    return new;
  end if;
  insert into public.audit_log (user_id, accion, entidad, entidad_id, payload_antes, payload_despues)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'last_login_at' else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) - 'last_login_at' else null end);
  return coalesce(new, old);
end $$;
revoke execute on function public.fn_audit_log_profiles() from public, anon, authenticated;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.fn_audit_log_profiles();

-- Una cuenta con historial no se borra: ni desde Auth ni desde la API.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete restrict;
revoke delete, truncate on public.profiles from anon, authenticated;
