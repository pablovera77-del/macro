-- Paquete 1 (feedback de Vanina 06/10): H17 Transporte desde Administración.
drop policy if exists insert_transport_tasks on public.transport_tasks;
create policy insert_transport_tasks on public.transport_tasks for insert
  with check (public.get_current_app_role() in ('transporte','deposito','administracion'));
drop policy if exists update_transport_tasks on public.transport_tasks;
create policy update_transport_tasks on public.transport_tasks for update
  using (public.get_current_app_role() in ('transporte','deposito','administracion'))
  with check (public.get_current_app_role() in ('transporte','deposito','administracion'));

-- H5: dos motivos de egreso nuevos (Vanina 06/10).
alter type public.discharge_reason add value if not exists 'alta_voluntaria';
alter type public.discharge_reason add value if not exists 'no_se_inicia_id';

-- H1 y H2: datos de admisión y marcas para filtrar el legajo.
alter table public.patients
  add column if not exists apellido text,
  add column if not exists nombre text,
  add column if not exists institucion_derivante text,
  add column if not exists unidad_trabajo text,
  add column if not exists tipo_internacion text,
  add column if not exists email_responsable text,
  add column if not exists tiene_coseguro boolean not null default false,
  add column if not exists coseguro_detalle text,
  add column if not exists es_particular boolean not null default false,
  add column if not exists tiene_emergencias boolean not null default false,
  add column if not exists emergencias_nombre text,
  add column if not exists emergencias_telefono text,
  add column if not exists en_tratamiento_atb boolean not null default false,
  add column if not exists requiere_curaciones boolean not null default false,
  add column if not exists egreso_solicitud_firmante text,
  add column if not exists egreso_solicitud_firmada_at timestamptz;

alter table public.patients drop constraint if exists patients_unidad_trabajo_chk;
alter table public.patients add constraint patients_unidad_trabajo_chk
  check (unidad_trabajo is null or unidad_trabajo in ('profesionales','expertos','malleo_lodge_1','malleo_lodge_2','san_juan_salud'));
alter table public.patients drop constraint if exists patients_tipo_internacion_chk;
alter table public.patients add constraint patients_tipo_internacion_chk
  check (tipo_internacion is null or tipo_internacion in
    ('visitas','soporte_nutricional_enteral','soporte_nutricional_parenteral','complejizada','centro_de_dia','estadia_permanente','plan_esencial','plan_premium'));

-- Más de un familiar de contacto (LEG-5). El responsable principal sigue en patients.contacto_familiar_*.
create table if not exists public.patient_contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  nombre text not null,
  parentesco text,
  telefono text,
  email text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index if not exists patient_contacts_patient_idx on public.patient_contacts(patient_id);
alter table public.patient_contacts enable row level security;
revoke all on public.patient_contacts from anon;
create policy select_patient_contacts on public.patient_contacts for select
  using (public.get_current_app_role() in ('administracion','coordinador_internacion','profesional_asistencial','direccion'));
create policy insert_patient_contacts on public.patient_contacts for insert
  with check (public.get_current_app_role() = 'administracion');
create policy update_patient_contacts on public.patient_contacts for update
  using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
create policy delete_patient_contacts on public.patient_contacts for delete
  using (public.get_current_app_role() = 'administracion');
revoke truncate on public.patient_contacts from authenticated;
create trigger trg_audit_patient_contacts after insert or update or delete on public.patient_contacts
  for each row execute function public.fn_audit_log();

-- Aclaraciones importantes (ING-13): solo personal clínico y administrativo, nunca el paciente ni el familiar.
create table if not exists public.patient_aclaraciones (
  id uuid not null unique default gen_random_uuid(),
  patient_id uuid primary key references public.patients(id) on delete cascade,
  texto text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.patient_aclaraciones enable row level security;
revoke all on public.patient_aclaraciones from anon;
create policy select_aclaraciones on public.patient_aclaraciones for select
  using (public.get_current_app_role() in ('administracion','coordinador_internacion','profesional_asistencial','direccion'));
create policy insert_aclaraciones on public.patient_aclaraciones for insert
  with check (public.get_current_app_role() = 'administracion');
create policy update_aclaraciones on public.patient_aclaraciones for update
  using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
revoke delete, truncate on public.patient_aclaraciones from authenticated;
create trigger trg_audit_patient_aclaraciones after insert or update or delete on public.patient_aclaraciones
  for each row execute function public.fn_audit_log();
