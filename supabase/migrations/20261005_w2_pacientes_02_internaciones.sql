-- Frente W2 — parte 2: separación persona/internación. Una fila por episodio en `patient_internaciones`
-- y una línea de tiempo no destructiva en `patient_status_history`. `patients` sigue guardando los datos
-- de la internación vigente (el código viejo sigue leyendo de ahí); los triggers mantienen los episodios.

create table public.patient_internaciones (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  numero integer not null default 1,
  estado text not null default 'en_curso' check (estado in ('en_curso','finalizada')),
  fecha_ingreso date,
  llegada_confirmada_at timestamptz,
  fecha_egreso date,
  egreso_hecho_at timestamptz,
  motivo_egreso public.discharge_reason,
  obra_social_id uuid references public.obras_sociales(id),
  numero_afiliado text,
  diagnostico text,
  creado_por uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (patient_id, numero)
);
create index patient_internaciones_patient_idx on public.patient_internaciones (patient_id, estado);
create index patient_internaciones_ingreso_idx on public.patient_internaciones (fecha_ingreso);
create index patient_internaciones_egreso_idx on public.patient_internaciones (fecha_egreso);

create table public.patient_status_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  internacion_id uuid references public.patient_internaciones(id) on delete set null,
  evento text not null check (evento in ('alta','reingreso','llegada','baja')),
  motivo public.discharge_reason,
  fecha_evento timestamptz not null default now(),
  informado_por uuid references public.profiles(id),
  informado_at timestamptz,
  confirmado_por uuid references public.profiles(id),
  observaciones text,
  created_at timestamptz not null default now()
);
create index patient_status_history_patient_idx on public.patient_status_history (patient_id, fecha_evento desc);
create index patient_status_history_fecha_idx on public.patient_status_history (fecha_evento);

-- Backfill: un episodio por paciente existente (sin tocar `patients`).
insert into public.patient_internaciones (patient_id, numero, estado, fecha_ingreso, llegada_confirmada_at, fecha_egreso, motivo_egreso, obra_social_id, numero_afiliado, diagnostico, created_at)
select p.id, 1, case when p.estado = 'dado_de_baja' then 'finalizada' else 'en_curso' end, p.fecha_ingreso, p.llegada_confirmada_at, p.fecha_egreso, p.motivo_egreso, p.obra_social_id, p.numero_afiliado, p.diagnostico_principal, p.created_at
from public.patients p
where not exists (select 1 from public.patient_internaciones i where i.patient_id = p.id);
insert into public.patient_status_history (patient_id, internacion_id, evento, fecha_evento, observaciones)
select i.patient_id, i.id, 'alta', coalesce((i.fecha_ingreso::timestamp at time zone 'America/Argentina/San_Juan'), i.created_at), 'Cargado desde el legajo existente'
from public.patient_internaciones i where not exists (select 1 from public.patient_status_history h where h.patient_id = i.patient_id);
insert into public.patient_status_history (patient_id, internacion_id, evento, fecha_evento, observaciones)
select i.patient_id, i.id, 'llegada', i.llegada_confirmada_at, 'Cargado desde el legajo existente' from public.patient_internaciones i where i.llegada_confirmada_at is not null;
insert into public.patient_status_history (patient_id, internacion_id, evento, motivo, fecha_evento, informado_por, informado_at, observaciones)
select i.patient_id, i.id, 'baja', i.motivo_egreso, coalesce((i.fecha_egreso::timestamp at time zone 'America/Argentina/San_Juan'), now()), p.egreso_informado_por, p.egreso_informado_at, 'Cargado desde el legajo existente'
from public.patient_internaciones i join public.patients p on p.id = i.patient_id where i.estado = 'finalizada';

-- Trigger sobre `patients`: alta (episodio 1), llegada, baja (cierra el episodio) y reingreso (episodio nuevo).
-- Funciona igual con el código viejo, que solo escribe en `patients`.
create or replace function public.fn_patients_episodios() returns trigger language plpgsql security definer set search_path = public as $$
declare v_int uuid; v_num int;
begin
  if tg_op = 'INSERT' then
    insert into public.patient_internaciones (patient_id, numero, estado, fecha_ingreso, llegada_confirmada_at, obra_social_id, numero_afiliado, diagnostico, creado_por)
      values (new.id, 1, 'en_curso', new.fecha_ingreso, new.llegada_confirmada_at, new.obra_social_id, new.numero_afiliado, new.diagnostico_principal, auth.uid())
      returning id into v_int;
    insert into public.patient_status_history (patient_id, internacion_id, evento, confirmado_por) values (new.id, v_int, 'alta', auth.uid());
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'dado_de_baja' then
      select id into v_int from public.patient_internaciones where patient_id = new.id and estado = 'en_curso' order by numero desc limit 1;
      if v_int is null then
        select coalesce(max(numero), 0) + 1 into v_num from public.patient_internaciones where patient_id = new.id;
        insert into public.patient_internaciones (patient_id, numero, estado, fecha_ingreso, llegada_confirmada_at, fecha_egreso, egreso_hecho_at, motivo_egreso, obra_social_id, numero_afiliado, diagnostico, creado_por)
          values (new.id, v_num, 'finalizada', new.fecha_ingreso, new.llegada_confirmada_at, new.fecha_egreso, new.egreso_hecho_at, new.motivo_egreso, new.obra_social_id, new.numero_afiliado, new.diagnostico_principal, auth.uid())
          returning id into v_int;
      else
        update public.patient_internaciones
           set estado = 'finalizada', fecha_egreso = new.fecha_egreso, egreso_hecho_at = new.egreso_hecho_at, motivo_egreso = new.motivo_egreso
         where id = v_int;
      end if;
      insert into public.patient_status_history (patient_id, internacion_id, evento, motivo, fecha_evento, informado_por, informado_at, confirmado_por)
        values (new.id, v_int, 'baja', new.motivo_egreso, coalesce(new.egreso_hecho_at, now()), new.egreso_informado_por, new.egreso_informado_at, auth.uid());
    elsif old.estado = 'dado_de_baja' then
      select coalesce(max(numero), 0) + 1 into v_num from public.patient_internaciones where patient_id = new.id;
      insert into public.patient_internaciones (patient_id, numero, estado, fecha_ingreso, llegada_confirmada_at, obra_social_id, numero_afiliado, diagnostico, creado_por)
        values (new.id, v_num, 'en_curso', new.fecha_ingreso, new.llegada_confirmada_at, new.obra_social_id, new.numero_afiliado, new.diagnostico_principal, auth.uid())
        returning id into v_int;
      insert into public.patient_status_history (patient_id, internacion_id, evento, confirmado_por) values (new.id, v_int, 'reingreso', auth.uid());
    elsif new.estado = 'activo' then
      update public.patient_internaciones set llegada_confirmada_at = coalesce(new.llegada_confirmada_at, now())
       where patient_id = new.id and estado = 'en_curso'
       returning id into v_int;
      insert into public.patient_status_history (patient_id, internacion_id, evento, fecha_evento, confirmado_por)
        values (new.id, v_int, 'llegada', coalesce(new.llegada_confirmada_at, now()), auth.uid());
    end if;
  elsif new.estado <> 'dado_de_baja'
        and (new.fecha_ingreso is distinct from old.fecha_ingreso or new.obra_social_id is distinct from old.obra_social_id
             or new.numero_afiliado is distinct from old.numero_afiliado or new.diagnostico_principal is distinct from old.diagnostico_principal) then
    -- Mientras la internación está en curso, el episodio acompaña los datos vigentes del legajo.
    update public.patient_internaciones
       set fecha_ingreso = new.fecha_ingreso, obra_social_id = new.obra_social_id, numero_afiliado = new.numero_afiliado, diagnostico = new.diagnostico_principal
     where patient_id = new.id and estado = 'en_curso';
  end if;
  return new;
end; $$;
revoke execute on function public.fn_patients_episodios() from public, anon, authenticated;
create trigger trg_patients_episodios after insert or update on public.patients for each row execute function public.fn_patients_episodios();

-- RLS: lectura para cualquier usuario activo; nadie escribe directo (lo hacen los triggers). Sin auditoría
-- propia: son datos derivados de `patients`, que ya se audita con trg_audit_patients.
alter table public.patient_internaciones enable row level security;
alter table public.patient_status_history enable row level security;
create policy select_internaciones on public.patient_internaciones for select using (public.get_current_app_role() is not null);
create policy select_status_history on public.patient_status_history for select using (public.get_current_app_role() is not null);
revoke all on public.patient_internaciones from anon;
revoke all on public.patient_status_history from anon;
revoke insert, update, delete, truncate on public.patient_internaciones from authenticated;
revoke insert, update, delete, truncate on public.patient_status_history from authenticated;
