-- ===== Plan de tratamiento por disciplina (DF-C3 §4.3) =====
create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  especialidad public.specialty not null,
  cantidad integer not null check (cantidad between 1 and 50),
  unidad text not null check (unidad in ('dia','semana')),
  dias_semana smallint[] check (dias_semana is null or dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]),
  desde date not null default current_date,
  hasta date,
  activo boolean not null default true,
  reemplaza_id uuid references public.treatment_plans(id),
  nota text,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.treatment_plans (patient_id) where activo;
alter table public.treatment_plans enable row level security;
create policy select_authenticated on public.treatment_plans for select using (auth.uid() is not null);
create policy write_plan_admin_coord on public.treatment_plans for insert
  with check (public.get_current_app_role() in ('administracion','coordinador_internacion'));
create policy update_plan_admin_coord on public.treatment_plans for update
  using (public.get_current_app_role() in ('administracion','coordinador_internacion'));

-- ===== Mensajes por paciente (G2) =====
create table public.patient_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) default auth.uid(),
  mensaje text not null check (length(btrim(mensaje)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.patient_messages (patient_id, created_at desc);
alter table public.patient_messages enable row level security;
create policy select_msgs on public.patient_messages for select using (
  public.get_current_app_role() in ('administracion','coordinador_internacion')
  or (public.get_current_app_role() = 'profesional_asistencial'
      and exists (select 1 from public.patient_care_team t where t.patient_id = patient_messages.patient_id and t.profesional_id = auth.uid()))
);
create policy insert_msgs on public.patient_messages for insert with check (
  autor_id = auth.uid() and (
    public.get_current_app_role() in ('administracion','coordinador_internacion')
    or (public.get_current_app_role() = 'profesional_asistencial'
        and exists (select 1 from public.patient_care_team t where t.patient_id = patient_messages.patient_id and t.profesional_id = auth.uid()))
  )
);

-- ===== Medicación vigente (paso 4 del alta) =====
create table public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medicamento text not null,
  dosis text,
  via text,
  frecuencia text,
  activo boolean not null default true,
  creado_por uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.patient_medications (patient_id) where activo;
alter table public.patient_medications enable row level security;
create policy select_meds on public.patient_medications for select
  using (public.get_current_app_role() in ('administracion','coordinador_internacion','profesional_asistencial'));
create policy insert_meds on public.patient_medications for insert
  with check (public.get_current_app_role() in ('administracion','coordinador_internacion'));
create policy update_meds on public.patient_medications for update
  using (public.get_current_app_role() in ('administracion','coordinador_internacion'));

-- ===== Checklist "Información al Paciente" (R PFS 01, 11 ítems — paso 5) =====
create table public.info_checklist_items (
  id uuid primary key default gen_random_uuid(),
  orden integer not null,
  texto text not null,
  activo boolean not null default true
);
alter table public.info_checklist_items enable row level security;
create policy select_authenticated on public.info_checklist_items for select using (auth.uid() is not null);
create policy write_items_admin on public.info_checklist_items for all
  using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
insert into public.info_checklist_items (orden, texto) values
 (1,'Información de prestación a brindar, autorizada por obra social.'),
 (2,'Consulta sobre condiciones del paciente (medicación endovenosa o vía oral).'),
 (3,'Si la medicación es oral, el familiar debe gestionar la autorización en forma particular.'),
 (4,'Si la medicación es endovenosa, el Sanatorio debe entregar medicación para 3 días.'),
 (5,'Información de contratación de servicios de emergencias.'),
 (6,'Si el paciente requiere oxígeno, el servicio debe coordinarse con el proveedor.'),
 (7,'Comunicación con la encargada administrativa una vez que el paciente está en el domicilio.'),
 (8,'La planilla de Kinesiología requiere la firma del familiar en cada prestación.'),
 (9,'La carpeta de documentación debe estar disponible en el domicilio para el personal y el médico auditor.'),
 (10,'Se informa y entrega copia de los teléfonos de comunicación.'),
 (11,'Es obligación de la familia entregar en administración (o a los enfermeros) la carpeta completa con la Historia Clínica.');

create table public.patient_info_checklist (
  patient_id uuid not null references public.patients(id) on delete cascade,
  item_id uuid not null references public.info_checklist_items(id),
  confirmado_at timestamptz not null default now(),
  confirmado_por uuid references public.profiles(id) default auth.uid(),
  primary key (patient_id, item_id)
);
alter table public.patient_info_checklist enable row level security;
create policy select_chk on public.patient_info_checklist for select
  using (public.get_current_app_role() in ('administracion','coordinador_internacion','profesional_asistencial'));
create policy insert_chk on public.patient_info_checklist for insert
  with check (public.get_current_app_role() = 'administracion');
create policy delete_chk on public.patient_info_checklist for delete
  using (public.get_current_app_role() = 'administracion');

-- ===== Documentación requerida por obra social (paso 6) — catálogo configurable =====
create table public.os_required_documents (
  id uuid primary key default gen_random_uuid(),
  obra_social_id uuid not null references public.obras_sociales(id) on delete cascade,
  nombre text not null,
  obligatorio boolean not null default true,
  orden integer not null default 0,
  activo boolean not null default true
);
create index on public.os_required_documents (obra_social_id) where activo;
alter table public.os_required_documents enable row level security;
create policy select_authenticated on public.os_required_documents for select using (auth.uid() is not null);
create policy write_osdocs_admin on public.os_required_documents for all
  using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');

create table public.patient_required_documents (
  patient_id uuid not null references public.patients(id) on delete cascade,
  doc_id uuid not null references public.os_required_documents(id) on delete cascade,
  recibido_at timestamptz not null default now(),
  recibido_por uuid references public.profiles(id) default auth.uid(),
  primary key (patient_id, doc_id)
);
alter table public.patient_required_documents enable row level security;
create policy select_prd on public.patient_required_documents for select
  using (public.get_current_app_role() in ('administracion','coordinador_internacion'));
create policy insert_prd on public.patient_required_documents for insert
  with check (public.get_current_app_role() = 'administracion');
create policy delete_prd on public.patient_required_documents for delete
  using (public.get_current_app_role() = 'administracion');

-- ===== Auditoría (DF-C1 §4.1): variante sin contenido clínico para evolutions =====
create or replace function public.fn_audit_log_clinical()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.audit_log (user_id, accion, entidad, entidad_id, payload_antes, payload_despues)
  values (
    auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'respuestas' - 'upp_escala_nova5' else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) - 'respuestas' - 'upp_escala_nova5' else null end
  );
  return coalesce(new, old);
end; $$;

create trigger trg_audit_patients after insert or update or delete on public.patients for each row execute function public.fn_audit_log();
create trigger trg_audit_visits after insert or update or delete on public.visits for each row execute function public.fn_audit_log();
create trigger trg_audit_orders after insert or update or delete on public.orders for each row execute function public.fn_audit_log();
create trigger trg_audit_patient_authorizations after insert or update or delete on public.patient_authorizations for each row execute function public.fn_audit_log();
create trigger trg_audit_care_team after insert or update or delete on public.patient_care_team for each row execute function public.fn_audit_log();
create trigger trg_audit_treatment_plans after insert or update or delete on public.treatment_plans for each row execute function public.fn_audit_log();
create trigger trg_audit_medications after insert or update or delete on public.patient_medications for each row execute function public.fn_audit_log();
create trigger trg_audit_signatures after insert or update or delete on public.patient_document_signatures for each row execute function public.fn_audit_log();
create trigger trg_audit_evolutions after insert or update or delete on public.evolutions for each row execute function public.fn_audit_log_clinical();
