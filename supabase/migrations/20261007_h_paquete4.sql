-- Paquete 4 (Vanina 06/10): H6 asignación y avisos, H11 cupos por módulo, H12 guardias programadas.
set lock_timeout = '5s';

-- H11: cupo contratado de cada profesional (guía, no bloquea).
alter table public.profiles add column if not exists cupo_modulo text;
alter table public.profiles drop constraint if exists profiles_cupo_modulo_chk;
alter table public.profiles add constraint profiles_cupo_modulo_chk
  check (cupo_modulo is null or cupo_modulo in ('enfermeria_modulo','enfermeria_medio','kine_motora','kine_respiratoria'));

create or replace function public.admin_set_cupo(p_id uuid, p_cupo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración define el cupo de cada profesional.';
  end if;
  update public.profiles set cupo_modulo = nullif(p_cupo, '') where id = p_id;
  if not found then raise exception 'No encontramos a esa persona.'; end if;
end $$;
revoke execute on function public.admin_set_cupo(uuid, text) from public, anon;
grant execute on function public.admin_set_cupo(uuid, text) to authenticated;

-- H6: elegir coordinador de un paciente y avisar a Coordinación.
create or replace function public.asignar_coordinador(p_patient uuid, p_coord uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración elige el coordinador de un paciente.';
  end if;
  if p_coord is not null and not exists (select 1 from public.profiles where id = p_coord and role = 'coordinador_internacion' and active) then
    raise exception 'Esa persona no es coordinadora activa.';
  end if;
  update public.patients set coordinador_id = p_coord where id = p_patient;
  if not found then raise exception 'No encontramos al paciente.'; end if;
end $$;
revoke execute on function public.asignar_coordinador(uuid, uuid) from public, anon;
grant execute on function public.asignar_coordinador(uuid, uuid) to authenticated;

insert into public.alert_types (codigo, nombre, descripcion, urgencia, mensaje, canal_app, canal_email, canal_whatsapp, activo)
select 'ingreso_sin_asignar', 'Paciente con prácticas sin profesional asignado',
       'Se cargaron prácticas autorizadas y todavía falta asignar el equipo.', 'inmediata',
       'Hay un paciente con prácticas autorizadas sin profesional asignado.', true, false, false, true
where not exists (select 1 from public.alert_types where codigo = 'ingreso_sin_asignar');

create or replace function public.avisar_ingreso(p_patient uuid, p_especialidades text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_n integer;
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración avisa a Coordinación.';
  end if;
  select nombre_completo into v_nombre from public.patients where id = p_patient;
  if v_nombre is null then raise exception 'No encontramos al paciente.'; end if;
  insert into public.notifications (user_id, alert_type, mensaje, entidad, entidad_id, href)
  select c.id, 'ingreso_sin_asignar',
         'Prácticas autorizadas para ' || v_nombre || ' (' || array_to_string(p_especialidades, ', ') || '): falta asignar profesional.',
         'patients', p_patient::text, '/internacion'
    from public.profiles c
   where c.role = 'coordinador_internacion' and c.active
     and (c.especialidad is null or c.especialidad::text = any(p_especialidades)
          or not exists (select 1 from public.profiles x where x.role='coordinador_internacion' and x.active and x.especialidad::text = any(p_especialidades)));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.avisar_ingreso(uuid, text[]) from public, anon;
grant execute on function public.avisar_ingreso(uuid, text[]) to authenticated;

-- H12: guardias programadas del mes (lo que debería cubrirse; `turno_guardia` registra lo que se hizo).
create table if not exists public.guardias_programadas (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  profesional_id uuid references public.profiles(id),
  fecha date not null,
  desde time not null default '08:00',
  hasta time not null default '20:00',
  nota text check (nota is null or length(nota) <= 500),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint guardias_programadas_horas_chk check (desde <> hasta)
);
create index if not exists guardias_programadas_fecha_idx on public.guardias_programadas (fecha, patient_id);
create unique index if not exists guardias_programadas_uniq on public.guardias_programadas (patient_id, fecha, desde, coalesce(profesional_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.guardias_programadas enable row level security;
create policy gp_select on public.guardias_programadas for select using (public.get_current_app_role() is not null);
create policy gp_insert on public.guardias_programadas for insert with check (public.get_current_app_role() in ('coordinador_internacion','administracion'));
create policy gp_update on public.guardias_programadas for update using (public.get_current_app_role() in ('coordinador_internacion','administracion')) with check (public.get_current_app_role() in ('coordinador_internacion','administracion'));
create policy gp_delete on public.guardias_programadas for delete using (public.get_current_app_role() in ('coordinador_internacion','administracion'));
drop trigger if exists trg_audit_guardias_programadas on public.guardias_programadas;
create trigger trg_audit_guardias_programadas after insert or update or delete on public.guardias_programadas for each row execute function public.fn_audit_log();
