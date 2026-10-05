-- C2 · Turno de guardia del cuidador/profesional (R47-R49, R51, R52): ingreso, controles repetidos,
-- narrativa con autoguardado y cierre con firma del profesional y conformidad de la familia.
-- Todo aditivo: tablas nuevas con RLS.
set lock_timeout = '5s';

create table if not exists public.turno_guardia (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  profesional_id uuid not null default auth.uid() references public.profiles(id),
  hora_ingreso timestamptz not null default now(),
  hora_egreso timestamptz,
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  narrativa text check (narrativa is null or length(narrativa) <= 20000),
  firma_profesional_img text check (firma_profesional_img is null or length(firma_profesional_img) <= 400000),
  firma_profesional_nombre text,
  firma_profesional_matricula text,
  conformidad_nombre text,
  conformidad_firma text check (conformidad_firma is null or length(conformidad_firma) <= 400000),
  created_at timestamptz not null default now()
);
create table if not exists public.turno_guardia_controles (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turno_guardia(id),
  hora timestamptz not null default now(),
  pa text,
  fc numeric,
  fr numeric,
  ax numeric,
  created_by uuid not null default auth.uid() references public.profiles(id)
);
create index if not exists turno_guardia_patient_idx on public.turno_guardia (patient_id, hora_ingreso desc);
create index if not exists turno_guardia_estado_idx on public.turno_guardia (estado) where estado = 'abierto';
create index if not exists turno_guardia_controles_turno_idx on public.turno_guardia_controles (turno_id, hora);
create unique index if not exists turno_guardia_abierto_uniq on public.turno_guardia (profesional_id, patient_id) where estado = 'abierto';
alter table public.turno_guardia enable row level security;
alter table public.turno_guardia_controles enable row level security;
revoke all on public.turno_guardia from anon;
revoke all on public.turno_guardia_controles from anon;
revoke delete, truncate on public.turno_guardia from authenticated;
revoke update, delete, truncate on public.turno_guardia_controles from authenticated;

create policy select_guardia on public.turno_guardia for select using (public.get_current_app_role() is not null);
create policy insert_guardia on public.turno_guardia for insert with check (public.get_current_app_role() = 'profesional_asistencial' and profesional_id = auth.uid() and estado = 'abierto');
create policy update_guardia on public.turno_guardia for update using (public.get_current_app_role() = 'profesional_asistencial' and profesional_id = auth.uid() and estado = 'abierto') with check (profesional_id = auth.uid());
create policy select_guardia_ctrl on public.turno_guardia_controles for select using (public.get_current_app_role() is not null);
create policy insert_guardia_ctrl on public.turno_guardia_controles for insert with check (
  public.get_current_app_role() = 'profesional_asistencial' and created_by = auth.uid()
  and exists (select 1 from public.turno_guardia t where t.id = turno_id and t.profesional_id = auth.uid() and t.estado = 'abierto'));

-- Un turno cerrado no se modifica; para cerrar hacen falta las dos firmas. La hora de egreso se completa sola.
create or replace function public.fn_guardia_cerrada_inmutable() returns trigger language plpgsql set search_path = public as $$
begin
  if old.estado = 'cerrado' and auth.uid() is not null then
    raise exception 'El turno de guardia ya está cerrado y no se puede modificar.' using errcode = 'check_violation';
  end if;
  if new.estado = 'cerrado' and old.estado = 'abierto' then
    if new.firma_profesional_img is null or new.conformidad_firma is null or coalesce(btrim(new.conformidad_nombre),'') = '' then
      raise exception 'Para cerrar el turno hacen falta la firma del profesional y la conformidad de la familia.' using errcode = 'check_violation';
    end if;
    new.hora_egreso := coalesce(new.hora_egreso, now());
  end if;
  return new;
end; $$;
create trigger trg_guardia_inmutable before update on public.turno_guardia for each row execute function public.fn_guardia_cerrada_inmutable();
create trigger trg_audit_turno_guardia after insert or update on public.turno_guardia for each row execute function public.fn_audit_log_clinical();

-- La auditoría clínica tampoco guarda la narrativa del turno.
create or replace function public.fn_audit_log_clinical()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  quitar text[] := array['respuestas','upp_escala_nova5','medicacion','alerta_motivo','firma_profesional_img','conformidad_firma','texto','narrativa'];
begin
  insert into public.audit_log (user_id, accion, entidad, entidad_id, payload_antes, payload_despues)
  values (
    auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - quitar else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) - quitar else null end
  );
  return coalesce(new, old);
end; $function$;
