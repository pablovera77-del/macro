-- Portal de familiares (G1): acceso por QR + PIN, solo lectura de visitas y
-- confirmación de visita realizada. Todo el acceso público pasa por funciones
-- security definer; las tablas no tienen políticas para visitantes.
create table public.family_access (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  pin_hash text not null,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  last_access_at timestamptz
);
alter table public.family_access enable row level security;  -- sin políticas: nadie la lee directo
revoke all on public.family_access from anon, authenticated;
create index family_access_patient_idx on public.family_access(patient_id);

create table public.family_visit_confirmations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  access_id uuid not null references public.family_access(id),
  nombre text not null,
  confirmed_at timestamptz not null default now()
);
alter table public.family_visit_confirmations enable row level security;
create policy select_family_confirmations on public.family_visit_confirmations for select
  using (public.get_current_app_role() in ('administracion','coordinador_internacion','direccion'));
revoke insert, update, delete on public.family_visit_confirmations from anon, authenticated;
revoke all on public.family_visit_confirmations from anon;

-- Auditoría sin secretos (nunca se guarda el token ni el hash del PIN).
create or replace function public.fn_audit_log_family()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.audit_log (user_id, accion, entidad, entidad_id, payload_antes, payload_despues)
  values (
    auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'token' - 'pin_hash' else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) - 'token' - 'pin_hash' else null end
  );
  return coalesce(new, old);
end; $$;
create trigger trg_audit_family_access after insert or update or delete on public.family_access
  for each row execute function public.fn_audit_log_family();
create trigger trg_audit_family_confirmations after insert on public.family_visit_confirmations
  for each row execute function public.fn_audit_log_family();

-- ===== Staff: generar, listar y revocar accesos =====
create or replace function public.fn_family_access_create(p_patient uuid)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_token text; v_pin text; v_exp timestamptz;
begin
  if public.get_current_app_role() not in ('administracion','coordinador_internacion') then
    raise exception 'Solo Administración o Coordinación generan el acceso de la familia.';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and estado <> 'dado_de_baja') then
    raise exception 'El paciente no existe o ya fue dado de baja.';
  end if;
  update public.family_access set revoked_at = now(), revoked_by = auth.uid()
    where patient_id = p_patient and revoked_at is null;
  v_token := encode(gen_random_bytes(18), 'hex');
  v_pin := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  insert into public.family_access (patient_id, token, pin_hash)
    values (p_patient, v_token, crypt(v_pin, gen_salt('bf')))
    returning expires_at into v_exp;
  return jsonb_build_object('token', v_token, 'pin', v_pin, 'expires_at', v_exp);
end; $$;

create or replace function public.fn_family_access_list(p_patient uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if public.get_current_app_role() not in ('administracion','coordinador_internacion') then
    raise exception 'Sin permiso.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'created_at', a.created_at, 'expires_at', a.expires_at, 'revoked_at', a.revoked_at,
      'last_access_at', a.last_access_at, 'locked_until', a.locked_until,
      'creado_por', (select full_name from public.profiles where id = a.created_by)
    ) order by a.created_at desc)
    from public.family_access a where a.patient_id = p_patient
  ), '[]'::jsonb);
end; $$;

create or replace function public.fn_family_access_revoke(p_access uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if public.get_current_app_role() not in ('administracion','coordinador_internacion') then
    raise exception 'Solo Administración o Coordinación revocan el acceso de la familia.';
  end if;
  update public.family_access set revoked_at = now(), revoked_by = auth.uid()
    where id = p_access and revoked_at is null;
end; $$;

-- ===== Visitantes: validar token + PIN (5 intentos fallidos = 15 min de bloqueo) =====
create or replace function public.fn__family_check(p_token text, p_pin text, out o_access uuid, out o_patient uuid, out o_error text)
language plpgsql security definer set search_path to 'public','extensions' as $$
declare a public.family_access%rowtype;
begin
  select * into a from public.family_access where token = p_token;
  if not found then o_error := 'invalido'; return; end if;
  if a.revoked_at is not null or a.expires_at < now() then o_error := 'vencido'; return; end if;
  if a.locked_until is not null and a.locked_until > now() then o_error := 'bloqueado'; return; end if;
  if p_pin is null or a.pin_hash <> crypt(p_pin, a.pin_hash) then
    update public.family_access
      set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
          locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
      where id = a.id;
    o_error := 'pin'; return;
  end if;
  update public.family_access set failed_attempts = 0, locked_until = null, last_access_at = now() where id = a.id;
  o_access := a.id; o_patient := a.patient_id;
end; $$;

create or replace function public.fn_family_portal_view(p_token text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c record; v_nombre text; v_prox jsonb; v_rec jsonb; v_exp timestamptz;
begin
  select * into c from public.fn__family_check(p_token, p_pin);
  if c.o_error is not null then return jsonb_build_object('ok', false, 'error', c.o_error); end if;
  select nombre_completo into v_nombre from public.patients where id = c.o_patient;
  select expires_at into v_exp from public.family_access where id = c.o_access;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'especialidad', x.especialidad, 'fecha', x.fecha_programada, 'estado', x.estado,
      'profesional', x.prof) order by x.fecha_programada), '[]'::jsonb) into v_prox
  from (select vi.id, vi.especialidad, vi.fecha_programada, vi.estado,
               (select full_name from public.profiles where id = vi.profesional_id) as prof
        from public.visits vi
        where vi.patient_id = c.o_patient and vi.estado in ('programada','confirmada')
          and vi.fecha_programada >= now() - interval '1 day'
        order by vi.fecha_programada limit 20) x;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', y.id, 'especialidad', y.especialidad, 'fecha', coalesce(y.fecha_realizada, y.fecha_programada),
      'estado', y.estado, 'profesional', y.prof, 'confirmada_at', y.conf_at, 'confirmada_por', y.conf_por)
      order by coalesce(y.fecha_realizada, y.fecha_programada) desc), '[]'::jsonb) into v_rec
  from (select vi.id, vi.especialidad, vi.fecha_programada, vi.fecha_realizada, vi.estado,
               (select full_name from public.profiles where id = vi.profesional_id) as prof,
               f.confirmed_at as conf_at, f.nombre as conf_por
        from public.visits vi
        left join public.family_visit_confirmations f on f.visit_id = vi.id
        where vi.patient_id = c.o_patient and vi.estado in ('realizada','no_realizada')
          and coalesce(vi.fecha_realizada, vi.fecha_programada) >= now() - interval '45 days'
        order by coalesce(vi.fecha_realizada, vi.fecha_programada) desc limit 30) y;
  return jsonb_build_object('ok', true, 'paciente', v_nombre, 'vence', v_exp, 'proximas', v_prox, 'recientes', v_rec);
end; $$;

create or replace function public.fn_family_confirm_visit(p_token text, p_pin text, p_visit uuid, p_nombre text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c record; v_nombre text := nullif(btrim(p_nombre), '');
begin
  select * into c from public.fn__family_check(p_token, p_pin);
  if c.o_error is not null then return jsonb_build_object('ok', false, 'error', c.o_error); end if;
  if v_nombre is null or length(v_nombre) > 120 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
  if not exists (select 1 from public.visits where id = p_visit and patient_id = c.o_patient and estado = 'realizada') then
    return jsonb_build_object('ok', false, 'error', 'visita');
  end if;
  insert into public.family_visit_confirmations (visit_id, access_id, nombre)
    values (p_visit, c.o_access, v_nombre) on conflict (visit_id) do nothing;
  return jsonb_build_object('ok', true);
end; $$;

-- Permisos de ejecución: lo interno no se expone; el portal lo ven visitantes; la gestión, solo sesiones.
revoke all on function public.fn__family_check(text, text) from public, anon, authenticated;
revoke all on function public.fn_family_access_create(uuid) from public, anon;
revoke all on function public.fn_family_access_list(uuid) from public, anon;
revoke all on function public.fn_family_access_revoke(uuid) from public, anon;
revoke all on function public.fn_family_portal_view(text, text) from public;
revoke all on function public.fn_family_confirm_visit(text, text, uuid, text) from public;
grant execute on function public.fn_family_access_create(uuid) to authenticated;
grant execute on function public.fn_family_access_list(uuid) to authenticated;
grant execute on function public.fn_family_access_revoke(uuid) to authenticated;
grant execute on function public.fn_family_portal_view(text, text) to anon, authenticated;
grant execute on function public.fn_family_confirm_visit(text, text, uuid, text) to anon, authenticated;
