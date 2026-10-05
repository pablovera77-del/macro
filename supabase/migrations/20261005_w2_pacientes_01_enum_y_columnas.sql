-- Frente W2 (Pacientes e internaciones, C3) — parte 1: motivos de egreso, columnas nuevas del legajo,
-- número de historia clínica de por vida y restricciones de DNI documentadas.
-- Todo es aditivo. Aplicado en la base real con execute_sql en pedazos chicos.

-- ===== Motivos de egreso ampliados (cada `alter type ... add value` va en su propia llamada) =====
-- Los valores viejos (alta, fallecimiento, fin_internacion) se conservan; la app los muestra con su etiqueta.
alter type public.discharge_reason add value if not exists 'alta_medica';
alter type public.discharge_reason add value if not exists 'traslado_otro_domicilio';
alter type public.discharge_reason add value if not exists 'traslado_otra_institucion';
alter type public.discharge_reason add value if not exists 'internacion_otro';

-- ===== Restricciones de DNI (ya existían en la base; se documentan acá, idempotente) =====
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patients_dni_key') then
    alter table public.patients add constraint patients_dni_key unique (dni);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_dni_format_check') then
    alter table public.patients add constraint patients_dni_format_check check (dni ~ '^[0-9]{6,9}$');
  end if;
end $$;

-- ===== Columnas nuevas de `patients` (todas nullable o con default) =====
alter table public.patients
  add column if not exists nro_historia_clinica bigint,
  add column if not exists sexo text,
  add column if not exists ocupacion text,
  add column if not exists localidad text,
  add column if not exists domicilio_actual text,
  add column if not exists telefono_actual text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists medico_matricula text,
  add column if not exists egreso_hecho_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.patients add constraint patients_sexo_check check (sexo is null or sexo in ('femenino','masculino','otro'));

-- ===== N° de historia clínica: secuencia + backfill por created_at + trigger (fijo de por vida) =====
create sequence if not exists public.patients_nro_historia_clinica_seq;
alter table public.patients disable trigger trg_audit_patients;  -- el backfill no es un cambio de datos que valga auditar
with ord as (select id, row_number() over (order by created_at, id) rn from public.patients where nro_historia_clinica is null)
update public.patients p set nro_historia_clinica = (select max(coalesce(nro_historia_clinica,0)) from public.patients) + ord.rn from ord where ord.id = p.id;
alter table public.patients enable trigger trg_audit_patients;
select setval('public.patients_nro_historia_clinica_seq', coalesce((select max(nro_historia_clinica) from public.patients),0)+1, false);
create unique index if not exists patients_nro_historia_clinica_key on public.patients (nro_historia_clinica);

create or replace function public.fn_patients_nro_hc() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.nro_historia_clinica is null then new.nro_historia_clinica := nextval('public.patients_nro_historia_clinica_seq'); end if;
  else
    -- El número de historia clínica es de por vida: nunca se cambia ni se borra.
    new.nro_historia_clinica := coalesce(old.nro_historia_clinica, new.nro_historia_clinica);
  end if;
  return new;
end; $$;
create trigger trg_patients_nro_hc before insert or update on public.patients for each row execute function public.fn_patients_nro_hc();

create or replace function public.fn_set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
create trigger trg_patients_updated_at before update on public.patients for each row execute function public.fn_set_updated_at();
