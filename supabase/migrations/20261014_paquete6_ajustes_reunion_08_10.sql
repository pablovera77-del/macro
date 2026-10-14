-- Paquete 6 (reunión 08/10 y respuestas de Vanina a los DF): cambios sin costo extra. Solo cambios aditivos.

-- 1) Pedidos de Depósito con frecuencia de renovación (DF-C5): se reutiliza el enum de reposición del paciente.
alter table public.orders add column if not exists frecuencia_renovacion public.replenishment_frequency not null default 'a_demanda';
alter table public.orders add column if not exists renovado_de uuid references public.orders(id);

-- 2) Legajo del personal (DF-C1 pregunta 3) y tipo de profesional de lista cerrada (pregunta 15).
alter table public.profiles add column if not exists fecha_nacimiento date;
alter table public.profiles add column if not exists domicilio text;
alter table public.profiles add column if not exists cuil text;
alter table public.profiles add column if not exists tipo_profesional text;
alter table public.profiles add column if not exists tipo_profesional_otro text;
alter table public.profiles add column if not exists firma_sello text; -- firma/sello digital (ruta en el bucket «legajos»)

create table if not exists public.profile_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('dni','titulo','matricula','vacunacion','mala_praxis','otro')),
  archivo text not null,
  nombre_original text,
  vence date,
  subido_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists profile_documents_profile_idx on public.profile_documents(profile_id);
alter table public.profile_documents enable row level security;
create policy profile_documents_select on public.profile_documents for select
  using (public.get_current_app_role() in ('administracion','direccion') or profile_id = auth.uid());
create policy profile_documents_insert on public.profile_documents for insert
  with check (public.get_current_app_role() = 'administracion');
create policy profile_documents_delete on public.profile_documents for delete
  using (public.get_current_app_role() = 'administracion');

insert into storage.buckets (id, name, public) values ('legajos', 'legajos', false) on conflict (id) do nothing;
create policy legajos_select on storage.objects for select
  using (bucket_id = 'legajos' and public.get_current_app_role() in ('administracion','direccion'));
create policy legajos_insert on storage.objects for insert
  with check (bucket_id = 'legajos' and public.get_current_app_role() = 'administracion');
create policy legajos_delete on storage.objects for delete
  using (bucket_id = 'legajos' and public.get_current_app_role() = 'administracion');

create or replace function public.admin_update_legajo_v2(
  p_id uuid, p_full_name text, p_especialidad specialty, p_dni text, p_matricula text, p_telefono text,
  p_email_contacto text, p_fecha_ingreso date, p_fecha_baja date,
  p_fecha_nacimiento date, p_domicilio text, p_cuil text, p_tipo_profesional text, p_tipo_profesional_otro text
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración carga el legajo del personal.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Falta el nombre.'; end if;
  update public.profiles set
    full_name = trim(p_full_name), especialidad = p_especialidad,
    dni = nullif(trim(p_dni), ''), matricula = nullif(trim(p_matricula), ''),
    telefono = nullif(trim(p_telefono), ''), email_contacto = nullif(trim(p_email_contacto), ''),
    fecha_ingreso = p_fecha_ingreso, fecha_baja = p_fecha_baja,
    fecha_nacimiento = p_fecha_nacimiento, domicilio = nullif(trim(p_domicilio), ''),
    cuil = nullif(trim(p_cuil), ''), tipo_profesional = nullif(trim(p_tipo_profesional), ''),
    tipo_profesional_otro = nullif(trim(p_tipo_profesional_otro), '')
  where id = p_id;
  if not found then raise exception 'No encontramos a esa persona.'; end if;
end $$;
revoke execute on function public.admin_update_legajo_v2 from anon, public;
grant execute on function public.admin_update_legajo_v2 to authenticated;

-- 3) UPP al ingreso, cargada por Administración (DF-C2 pregunta 8).
alter table public.patients add column if not exists upp_ingreso_nova5 jsonb;
alter table public.patients add column if not exists upp_ingreso_at timestamptz;

-- 4) Guardia de kinesiología de fin de semana: ve a todos los pacientes de kinesiología de lunes a lunes (DF-C2).
create table if not exists public.guardias_kine_fin_de_semana (
  id uuid primary key default gen_random_uuid(),
  sabado date not null,
  profesional_id uuid references public.profiles(id),
  nota text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint guardias_kine_sabado_chk check (extract(isodow from sabado) = 6),
  unique (sabado, profesional_id)
);
alter table public.guardias_kine_fin_de_semana enable row level security;
create policy gkfs_select on public.guardias_kine_fin_de_semana for select using (public.get_current_app_role() is not null);
create policy gkfs_insert on public.guardias_kine_fin_de_semana for insert with check (public.get_current_app_role() in ('coordinador_internacion','administracion'));
create policy gkfs_update on public.guardias_kine_fin_de_semana for update using (public.get_current_app_role() in ('coordinador_internacion','administracion')) with check (public.get_current_app_role() in ('coordinador_internacion','administracion'));
create policy gkfs_delete on public.guardias_kine_fin_de_semana for delete using (public.get_current_app_role() in ('coordinador_internacion','administracion'));

-- 5) Semana sin día fijo (DF-C2 pregunta 3): se controla por semana, no por día.
alter table public.treatment_authorizations drop constraint if exists treatment_authorizations_frecuencia_tipo_check;
alter table public.treatment_authorizations add constraint treatment_authorizations_frecuencia_tipo_check
  check (frecuencia_tipo is null or frecuencia_tipo in ('diaria','semanal','por_semana'));

create or replace view public.v_control_frecuencia_semanal with (security_invoker = true) as
with sem as (
  select (d - ((extract(isodow from d)::int - 1) + 7)) as lunes
  from (select (now() at time zone 'America/Argentina/San_Juan')::date as d) t
)
select ta.id as treatment_authorization_id, p.id as patient_id, p.nombre_completo, ta.practica, ta.especialidad::text as especialidad,
       s.lunes as semana_desde, (s.lunes + 6) as semana_hasta, ta.dias_semana,
       (dd.dias * coalesce(ta.veces_por_dia, 1))::integer as esperadas, coalesce(ev.cnt, 0::bigint) as cargadas
from sem s
join public.treatment_authorizations ta on ta.frecuencia_tipo = 'semanal' and ta.dias_semana is not null
     and ta.periodo_desde <= s.lunes + 6 and ta.periodo_hasta >= s.lunes
join public.patients p on p.id = ta.patient_id and p.estado <> 'admitido_pendiente_llegada'
cross join lateral (
  select count(*) as dias
  from generate_series(s.lunes::timestamp, (s.lunes + 6)::timestamp, interval '1 day') g
  where extract(isodow from g)::int = any (ta.dias_semana)
    and g::date between greatest(ta.periodo_desde, p.fecha_ingreso, (p.llegada_confirmada_at at time zone 'America/Argentina/San_Juan')::date)
                    and least(ta.periodo_hasta, p.fecha_egreso, (p.egreso_informado_at at time zone 'America/Argentina/San_Juan')::date)
) dd
left join lateral (
  select count(*) as cnt from public.evolutions e
  where e.patient_id = p.id and e.especialidad = ta.especialidad
    and (e.created_at at time zone 'America/Argentina/San_Juan')::date between s.lunes and s.lunes + 6
) ev on true
where dd.dias > 0 and coalesce(ev.cnt, 0) < dd.dias * coalesce(ta.veces_por_dia, 1)
union all
select ta.id, p.id, p.nombre_completo, ta.practica, ta.especialidad::text,
       s.lunes, (s.lunes + 6), null::smallint[],
       ta.frecuencia_cantidad::integer, coalesce(ev.cnt, 0::bigint)
from sem s
join public.treatment_authorizations ta on ta.frecuencia_tipo = 'por_semana'
     and ta.periodo_desde <= s.lunes and ta.periodo_hasta >= s.lunes + 6
join public.patients p on p.id = ta.patient_id and p.estado = 'activo'
left join lateral (
  select count(*) as cnt from public.evolutions e
  where e.patient_id = p.id and e.especialidad = ta.especialidad
    and (e.created_at at time zone 'America/Argentina/San_Juan')::date between s.lunes and s.lunes + 6
) ev on true
where coalesce(ev.cnt, 0) < ta.frecuencia_cantidad
  and (p.fecha_ingreso is null or p.fecha_ingreso <= s.lunes)
  and (p.llegada_confirmada_at is null or (p.llegada_confirmada_at at time zone 'America/Argentina/San_Juan')::date <= s.lunes)
  and (p.fecha_egreso is null or p.fecha_egreso >= s.lunes + 6)
  and (p.egreso_informado_at is null or (p.egreso_informado_at at time zone 'America/Argentina/San_Juan')::date >= s.lunes + 6);
revoke all on public.v_control_frecuencia_semanal from anon;

-- 6) Controles del turno de guardia: diuresis y catarsis, como en la planilla de enfermería.
alter table public.turno_guardia_controles add column if not exists diuresis boolean;
alter table public.turno_guardia_controles add column if not exists catarsis boolean;

-- 7) Firma y sello digital del coordinador (pie de los PDF). Solo Administración lo carga.
create or replace function public.admin_set_firma_sello(p_id uuid, p_firma text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if public.get_current_app_role() is distinct from 'administracion' then
    raise exception 'Solo Administración carga la firma y el sello de una persona.';
  end if;
  if p_firma is not null and (p_firma !~ '^data:image/(png|jpeg|webp);base64,' or length(p_firma) > 300000) then
    raise exception 'La imagen de la firma no es válida o es demasiado pesada.';
  end if;
  update public.profiles set firma_sello = p_firma where id = p_id;
  if not found then raise exception 'No encontramos a esa persona.'; end if;
end $$;
revoke execute on function public.admin_set_firma_sello(uuid, text) from public, anon;
grant execute on function public.admin_set_firma_sello(uuid, text) to authenticated;
