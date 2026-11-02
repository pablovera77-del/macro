-- Paquete 8 · Comentarios de Vanina del 26/10/2026 (DF-C2, DF-C3, DF-C4).
-- Todo es aditivo y se puede volver a ejecutar sin romper nada.

-- 1) Condiciones clínicas del paciente al ingreso: oxígeno permanente, soporte nutricional (SNG o gastrostomía) y acceso venoso.
--    Se suman a «En tratamiento antibiótico» y «Requiere curaciones» y sirven para filtrar el listado y para el dashboard ejecutivo.
alter table public.patients
  add column if not exists requiere_oxigeno boolean not null default false,
  add column if not exists soporte_nutricional text,
  add column if not exists acceso_venoso text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patients_soporte_nutricional_chk') then
    alter table public.patients add constraint patients_soporte_nutricional_chk check (soporte_nutricional is null or soporte_nutricional in ('sng', 'gastrostomia'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_acceso_venoso_chk') then
    alter table public.patients add constraint patients_acceso_venoso_chk check (acceso_venoso is null or acceso_venoso in ('via_central', 'via_periferica', 'sin_via'));
  end if;
end $$;

-- 2) Estudios complementarios del paciente (laboratorio, radiografías, biopsias, etc.), con archivo adjunto,
--    y solicitudes de estudios del médico a Administración.
create table if not exists public.patient_studies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  descripcion text not null check (length(btrim(descripcion)) > 0),
  fecha_estudio date,
  se_factura boolean not null default false,
  autorizado boolean,
  archivo text,
  nombre_original text,
  solicitud_id uuid,
  cargado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint patient_studies_autorizado_chk check (se_factura or autorizado is null)
);
create index if not exists patient_studies_patient_idx on public.patient_studies(patient_id);

create table if not exists public.study_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  detalle text not null check (length(btrim(detalle)) > 0),
  solicitado_por uuid not null references public.profiles(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'gestionado', 'cancelado')),
  created_at timestamptz not null default now(),
  gestionado_por uuid references public.profiles(id),
  gestionado_at timestamptz
);
create index if not exists study_requests_patient_idx on public.study_requests(patient_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patient_studies_solicitud_fk') then
    alter table public.patient_studies add constraint patient_studies_solicitud_fk foreign key (solicitud_id) references public.study_requests(id) on delete set null;
  end if;
end $$;

alter table public.patient_studies enable row level security;
alter table public.study_requests enable row level security;
revoke all on public.patient_studies from anon;
revoke all on public.study_requests from anon;

-- Quién ve los estudios: personal de oficina y control, y el profesional que tiene al paciente en su equipo.
create or replace function public.fn_puede_ver_estudios(p_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.get_current_app_role() in ('administracion', 'coordinador_internacion', 'direccion', 'facturacion', 'auditor_externo') then true
    when public.get_current_app_role() = 'profesional_asistencial'
      then exists (select 1 from public.patient_care_team t where t.patient_id = p_patient and t.profesional_id = auth.uid())
    else false end;
$$;
revoke all on function public.fn_puede_ver_estudios(uuid) from public, anon;
grant execute on function public.fn_puede_ver_estudios(uuid) to authenticated;

drop policy if exists patient_studies_select on public.patient_studies;
create policy patient_studies_select on public.patient_studies for select using (public.fn_puede_ver_estudios(patient_id));
drop policy if exists patient_studies_insert on public.patient_studies;
create policy patient_studies_insert on public.patient_studies for insert with check (public.get_current_app_role() = 'administracion');
drop policy if exists patient_studies_update on public.patient_studies;
create policy patient_studies_update on public.patient_studies for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
drop policy if exists patient_studies_delete on public.patient_studies;
create policy patient_studies_delete on public.patient_studies for delete using (public.get_current_app_role() = 'administracion');

drop policy if exists study_requests_select on public.study_requests;
create policy study_requests_select on public.study_requests for select
  using (public.get_current_app_role() in ('administracion', 'coordinador_internacion', 'direccion') or solicitado_por = auth.uid() or public.fn_puede_ver_estudios(patient_id));
drop policy if exists study_requests_update on public.study_requests;
create policy study_requests_update on public.study_requests for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
-- Sin policy de insert: las solicitudes se crean solo con fn_solicitar_estudio.

drop trigger if exists trg_audit_patient_studies on public.patient_studies;
create trigger trg_audit_patient_studies after insert or update or delete on public.patient_studies for each row execute function public.fn_audit_log();
drop trigger if exists trg_audit_study_requests on public.study_requests;
create trigger trg_audit_study_requests after insert or update or delete on public.study_requests for each row execute function public.fn_audit_log();

-- Archivos de los estudios (PDF o imagen, hasta 10 MB). Ruta: <patient_id>/<uuid>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estudios', 'estudios', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
drop policy if exists estudios_select on storage.objects;
create policy estudios_select on storage.objects for select
  using (bucket_id = 'estudios' and public.fn_puede_ver_estudios(nullif(split_part(name, '/', 1), '')::uuid));
drop policy if exists estudios_insert on storage.objects;
create policy estudios_insert on storage.objects for insert
  with check (bucket_id = 'estudios' and public.get_current_app_role() = 'administracion');
drop policy if exists estudios_delete on storage.objects;
create policy estudios_delete on storage.objects for delete
  using (bucket_id = 'estudios' and public.get_current_app_role() = 'administracion');

insert into public.alert_types (codigo, nombre, descripcion, urgencia, mensaje, canal_app, canal_email, canal_whatsapp, activo)
select 'estudio_solicitado', 'El médico solicitó un estudio', 'Un médico pidió un estudio complementario para un paciente. Administración lo gestiona (presupuesto, autorización o turno).', 'inmediata',
       '{profesional} solicitó un estudio para {paciente}: {estudio}.', true, false, false, true
where not exists (select 1 from public.alert_types where codigo = 'estudio_solicitado');
insert into public.alert_type_recipients (alert_type, role)
select 'estudio_solicitado', 'administracion'::public.app_role
 where not exists (select 1 from public.alert_type_recipients x where x.alert_type = 'estudio_solicitado' and x.role = 'administracion'::public.app_role);

-- El médico solicita un estudio: queda registrado y se avisa a Administración.
create or replace function public.fn_solicitar_estudio(p_patient uuid, p_detalle text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me public.profiles; pac text; nuevo uuid;
begin
  select * into me from public.profiles where id = uid and active;
  if uid is null or not found or me.role is distinct from 'profesional_asistencial' or me.especialidad is distinct from 'medicina' then
    raise exception 'Solo un médico puede solicitar estudios.';
  end if;
  if p_detalle is null or length(btrim(p_detalle)) = 0 then raise exception 'Escribí qué estudio necesitás.'; end if;
  if not exists (select 1 from public.patient_care_team t where t.patient_id = p_patient and t.profesional_id = uid) then
    raise exception 'El paciente no está en tu equipo de cuidado.';
  end if;
  select nombre_completo into pac from public.patients where id = p_patient;
  insert into public.study_requests (patient_id, detalle, solicitado_por) values (p_patient, btrim(p_detalle), uid) returning id into nuevo;
  perform public.fn_notificar('estudio_solicitado',
    jsonb_build_object('profesional', coalesce(me.full_name, 'Un médico'), 'paciente', coalesce(pac, 'un paciente'), 'estudio', left(btrim(p_detalle), 120)),
    '/paciente/' || p_patient::text || '?tab=estudios', 'study_requests', nuevo::text, '{}');
  return nuevo;
end $$;
revoke all on function public.fn_solicitar_estudio(uuid, text) from public, anon;
grant execute on function public.fn_solicitar_estudio(uuid, text) to authenticated;

-- 3) Suspensión temporal del servicio (internación transitoria en obras sociales que prorrogan mensualmente:
--    Sancor, OSDE, Jerárquicos, OSFATLYF). Se registra el período sin servicio dentro de la misma autorización.
create table if not exists public.service_suspensions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  desde date not null,
  hasta date,
  motivo text,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint service_suspensions_fechas_chk check (hasta is null or hasta >= desde)
);
create index if not exists service_suspensions_patient_idx on public.service_suspensions(patient_id);
alter table public.service_suspensions enable row level security;
revoke all on public.service_suspensions from anon;
drop policy if exists service_suspensions_select on public.service_suspensions;
create policy service_suspensions_select on public.service_suspensions for select
  using (public.get_current_app_role() in ('administracion', 'coordinador_internacion', 'direccion', 'facturacion', 'auditor_externo'));
drop policy if exists service_suspensions_insert on public.service_suspensions;
create policy service_suspensions_insert on public.service_suspensions for insert with check (public.get_current_app_role() = 'administracion');
drop policy if exists service_suspensions_update on public.service_suspensions;
create policy service_suspensions_update on public.service_suspensions for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
drop trigger if exists trg_audit_service_suspensions on public.service_suspensions;
create trigger trg_audit_service_suspensions after insert or update or delete on public.service_suspensions for each row execute function public.fn_audit_log();

-- 4) Formulario de Nutrición con datos comparables (peso, talla, IMC y % de pérdida calculados, soporte, indicación, requerimientos).
update public.discipline_form_templates set
  campos = $json$[
    {"label":"Peso actual (kg)","clave":"peso_actual","tipo":"Número","paso":"0.1","obligatorio":true,"seccion":"Antropometría"},
    {"label":"Peso habitual (kg)","clave":"peso_habitual","tipo":"Número","paso":"0.1","obligatorio":false,"seccion":"Antropometría"},
    {"label":"Talla (m)","clave":"talla","tipo":"Número","paso":"0.01","obligatorio":true,"seccion":"Antropometría","ayuda":"En metros (ej. 1,70). Si la cargás en centímetros se convierte sola."},
    {"label":"IMC","clave":"imc","tipo":"Calculado","formula":"imc","seccion":"Antropometría","ayuda":"Peso actual dividido la talla al cuadrado. Se calcula solo."},
    {"label":"% de pérdida de peso","clave":"perdida_peso","tipo":"Calculado","formula":"perdida_peso","seccion":"Antropometría","ayuda":"(Peso habitual − peso actual) / peso habitual × 100. Se calcula solo."},
    {"label":"Diagnóstico nutricional","clave":"diagnostico_nutricional","tipo":"Selección","obligatorio":false,"seccion":"Antropometría","opciones":["Bajo peso","Normopeso","Sobrepeso","Obesidad grado 1","Obesidad grado 2","Riesgo nutricional"]},
    {"label":"Soporte nutricional","clave":"soporte_nutricional","tipo":"Sí/No","obligatorio":false,"seccion":"Soporte nutricional"},
    {"label":"Ingesta oral","clave":"ingesta_oral","tipo":"Sí/No","obligatorio":false,"seccion":"Soporte nutricional"},
    {"label":"Tipo de acceso","clave":"tipo_acceso","tipo":"Selección","obligatorio":false,"seccion":"Soporte nutricional","opciones":["Oral","SNG","Gastrostomía","Mixto"]},
    {"label":"Indicación","clave":"indicacion","tipo":"Selección","obligatorio":false,"seccion":"Soporte nutricional","opciones":["Dieta oral","Fresubin Original","Fresubin Original Fibra","Fresubin Energy","Survimed OPD","Diben","Nutrison Standard","Nutrison Multifibra","Diason"]},
    {"label":"Volumen (ml)","clave":"volumen_ml","tipo":"Número","paso":"1","obligatorio":false,"seccion":"Soporte nutricional"},
    {"label":"Modo de infusión","clave":"modo_infusion","tipo":"Selección","obligatorio":false,"seccion":"Soporte nutricional","opciones":["Caída libre","Bolo","Bomba"]},
    {"label":"Velocidad de infusión (ml/h)","clave":"velocidad_infusion","tipo":"Número","paso":"1","obligatorio":false,"seccion":"Soporte nutricional"},
    {"label":"Indicación de hidratación (ml)","clave":"hidratacion_ml","tipo":"Número","paso":"1","obligatorio":false,"seccion":"Soporte nutricional"},
    {"label":"Proteínas totales por día (g/día)","clave":"proteinas_dia","tipo":"Número","paso":"1","obligatorio":false,"seccion":"Requerimientos totales"},
    {"label":"Calorías totales por día (kcal/día)","clave":"calorias_dia","tipo":"Número","paso":"1","obligatorio":false,"seccion":"Requerimientos totales"},
    {"label":"Evolución nutricional","clave":"evolucion","tipo":"Texto largo","obligatorio":true,"seccion":"Evolución"},
    {"label":"Indicaciones y plan","clave":"indicaciones","tipo":"Texto largo","obligatorio":false,"seccion":"Evolución"}
  ]$json$::jsonb
where especialidad = 'nutricion';

-- 5) Aviso de llegada al domicilio (DF-C3 pregunta 8): cuando la familia o el personal confirman la llegada se avisa
--    a Administración, a Coordinación y a los profesionales asignados al paciente.
insert into public.alert_types (codigo, nombre, descripcion, urgencia, mensaje, canal_app, canal_email, canal_whatsapp, activo)
select 'llegada_confirmada', 'Llegada del paciente al domicilio', 'Se confirmó que el paciente llegó al domicilio: ya se puede coordinar la primera visita.', 'inmediata',
       'Se confirmó que {paciente} llegó al domicilio.', true, false, false, true
where not exists (select 1 from public.alert_types where codigo = 'llegada_confirmada');
insert into public.alert_type_recipients (alert_type, role)
select 'llegada_confirmada', r::public.app_role
  from unnest(array['administracion', 'coordinador_internacion']) as r
 where not exists (select 1 from public.alert_type_recipients x where x.alert_type = 'llegada_confirmada' and x.role = r::public.app_role);

-- Función interna (la usa fn_arrival_confirm, que corre sin sesión): nadie la llama directo.
create or replace function public.fn_avisar_llegada(p_patient uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pac text;
begin
  select nombre_completo into pac from public.patients where id = p_patient;
  insert into public.notifications (user_id, alert_type, mensaje, href, entidad, entidad_id)
  select distinct pr.id, 'llegada_confirmada', 'Se confirmó que ' || coalesce(pac, 'el paciente') || ' llegó al domicilio.', '/paciente/' || p_patient::text, 'patients', p_patient::text
    from public.profiles pr
   where pr.active
     and (pr.role in (select r.role from public.alert_type_recipients r where r.alert_type = 'llegada_confirmada' and r.role is not null)
          or pr.id in (select t.profesional_id from public.patient_care_team t where t.patient_id = p_patient));
end $$;
revoke all on function public.fn_avisar_llegada(uuid) from public, anon, authenticated;

create or replace function public.fn_arrival_confirm(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; n integer;
begin
  select * into t from public.arrival_tokens where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalido'); end if;
  if t.used_at is not null then return jsonb_build_object('ok', true, 'ya_confirmado', true); end if;
  if t.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'vencido'); end if;
  update public.patients set estado = 'activo', llegada_confirmada_at = now()
   where id = t.patient_id and estado = 'admitido_pendiente_llegada';
  get diagnostics n = row_count;
  update public.arrival_tokens set used_at = now() where id = t.id;
  update public.patient_status_history set observaciones = 'Confirmada por la familia con el link de llegada'
   where id = (select h.id from public.patient_status_history h where h.patient_id = t.patient_id and h.evento = 'llegada' order by h.created_at desc limit 1);
  if n > 0 then perform public.fn_avisar_llegada(t.patient_id); end if;
  return jsonb_build_object('ok', true, 'ya_confirmado', false);
end; $$;
