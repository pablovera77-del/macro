-- W3 Configuración · 02 Catálogos y parámetros (DF-C1 §4.2; R42-R48, R78)

-- Catálogos genéricos editables sin tocar código. Los enums de la base quedan como referencia.
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalogo text not null,
  codigo text not null,
  nombre text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  unique (catalogo, codigo)
);
alter table public.catalog_items enable row level security;
revoke all on public.catalog_items from anon;
grant select, insert, update on public.catalog_items to authenticated;
create policy catalog_items_select on public.catalog_items for select using (public.get_current_app_role() is not null);
create policy catalog_items_insert on public.catalog_items for insert with check (public.get_current_app_role() = 'administracion');
create policy catalog_items_update on public.catalog_items for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');

insert into public.catalog_items (catalogo, codigo, nombre, orden) values
  ('especialidades','enfermeria','Enfermería',1),('especialidades','medicina','Medicina',2),
  ('especialidades','kinesiologia','Kinesiología',3),('especialidades','fonoaudiologia','Fonoaudiología',4),
  ('especialidades','nutricion','Nutrición',5),('especialidades','trabajo_social','Trabajo social',6),
  ('especialidades','psicologia','Psicología',7),('especialidades','otra','Otra',8),
  ('categorias_iva','21%','21 %',1),('categorias_iva','10.5%','10,5 %',2),('categorias_iva','27%','27 %',3),
  ('categorias_iva','5%','5 %',4),('categorias_iva','2.5%','2,5 %',5),('categorias_iva','Exento','Exento',6),('categorias_iva','No Gravado','No gravado',7),
  ('tipos_insumo','descartable','Descartable',1),('tipos_insumo','equipo','Equipo',2),('tipos_insumo','alimento','Alimento',3),
  ('motivos_baja','alta','Alta médica',1),('motivos_baja','fallecimiento','Fallecimiento',2),('motivos_baja','fin_internacion','Fin de la internación',3),
  ('motivos_reprogramacion','nadie_en_domicilio','No había nadie en el domicilio',1),
  ('motivos_reprogramacion','pedido_familia','Lo pidió la familia',2),
  ('motivos_reprogramacion','profesional_no_disponible','El profesional o el vehículo no estaba disponible',3),
  ('motivos_reprogramacion','imprevisto','Imprevisto (clima, tránsito, otro)',4),
  ('motivos_reprogramacion','otro','Otro motivo',5),
  ('coseguros','sin_coseguro','Sin coseguro',1),('coseguros','con_coseguro','Con coseguro a cargo del paciente',2)
on conflict (catalogo, codigo) do nothing;

-- Parámetros numéricos editables.
create table if not exists public.app_settings (
  clave text primary key,
  valor numeric not null check (valor >= 0),
  descripcion text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon;
grant select, insert, update on public.app_settings to authenticated;
create policy app_settings_select on public.app_settings for select using (public.get_current_app_role() is not null);
create policy app_settings_insert on public.app_settings for insert with check (public.get_current_app_role() = 'administracion');
create policy app_settings_update on public.app_settings for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');

create or replace function public.fn_app_settings_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
revoke execute on function public.fn_app_settings_touch() from public, anon, authenticated;
create trigger trg_app_settings_touch before update on public.app_settings
  for each row execute function public.fn_app_settings_touch();

insert into public.app_settings (clave, valor, descripcion) values
  ('dias_aviso_autorizacion', 7, 'Días de anticipación con los que una autorización de práctica pasa a «por vencer».'),
  ('horas_ubicacion_no_confirmada', 48, 'Horas desde el aviso de egreso después de las cuales un equipo retirado sin confirmar llegada a depósito se marca en rojo.'),
  ('umbral_visitas_dia', 6, 'Promedio diario esperado de visitas realizadas: por debajo, el tablero lo marca en amarillo.')
on conflict (clave) do nothing;

-- Las dos vistas leen los parámetros (mismas columnas y nombres; con los valores por defecto devuelven lo mismo).
create or replace view public.v_treatment_authorization_status with (security_invoker = true) as
 SELECT id, patient_id, practica, especialidad, cantidad_autorizada, periodo_desde, periodo_hasta, autorizado_por, created_at,
        CASE
            WHEN (periodo_hasta < CURRENT_DATE) THEN 'vencida'::authorization_status
            WHEN (periodo_hasta <= (CURRENT_DATE + (coalesce((select s.valor from public.app_settings s where s.clave = 'dias_aviso_autorizacion'), 7) * interval '1 day'))) THEN 'por_vencer'::authorization_status
            ELSE 'vigente'::authorization_status
        END AS estado_semaforo
   FROM treatment_authorizations ta;

create or replace view public.v_equipos_retirados_sin_confirmar with (security_invoker = true) as
 SELECT rc.id AS checklist_id, ea.numero_serie, p.descripcion, rc.retirado_at, rc.retirado_por,
        da.fecha AS egreso_notificado_at,
        ((da.fecha IS NOT NULL) AND (da.fecha < (now() - (coalesce((select s.valor from public.app_settings s where s.clave = 'horas_ubicacion_no_confirmada'), 48) * interval '1 hour')))) AS vencido_48h
   FROM (((retrieval_checklist rc
     JOIN equipment_assets ea ON ((ea.id = rc.asset_id)))
     JOIN products p ON ((p.id = ea.product_id)))
     LEFT JOIN discharge_alerts da ON ((da.id = rc.discharge_alert_id)))
  WHERE ((rc.retirado_at IS NOT NULL) AND (rc.llego_deposito_at IS NULL));

-- Las vistas no se exponen sin sesión.
revoke all on public.v_treatment_authorization_status, public.v_equipos_retirados_sin_confirmar from anon;

-- Obras sociales: coseguro por defecto (catálogo) y motivo al reprogramar una visita.
alter table public.obras_sociales add column if not exists coseguro_codigo text;
alter table public.visits add column if not exists motivo_reprogramacion text;
