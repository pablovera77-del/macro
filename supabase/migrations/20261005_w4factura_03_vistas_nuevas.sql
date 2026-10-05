-- Frente Facturación (C4) — vistas nuevas y ampliación de v_prevalidacion_resumen.

-- Resumen: las 4 columnas de siempre + conteo por paciente y exclusiones (C4-37, 38)
create or replace view public.v_prevalidacion_resumen as
select v.billing_period_id,
       count(*) filter (where v.estado_prevalidacion = 'rojo'::text) as rojos,
       count(*) filter (where v.estado_prevalidacion = 'amarillo'::text) as amarillos,
       count(*) filter (where v.estado_prevalidacion = 'verde'::text) as verdes,
       count(*) filter (where v.estado_prevalidacion = 'rojo'::text) > 0 as bloqueado,
       count(distinct v.patient_id) filter (where v.estado_control = 'rojo'::text) as pacientes_rojos,
       count(distinct v.patient_id) filter (where v.estado_control = 'rojo'::text and x.id is not null) as pacientes_rojos_excluidos,
       count(distinct v.patient_id) filter (where v.estado_control = 'rojo'::text and x.id is null) as pacientes_rojos_pendientes,
       count(distinct v.patient_id) as pacientes_total,
       count(distinct v.patient_id) filter (where v.estado_control = 'rojo'::text and x.id is null) > 0 as bloqueado_efectivo
from v_prevalidacion_facturacion v
left join billing_period_exclusions x on x.billing_period_id = v.billing_period_id and x.patient_id = v.patient_id
group by v.billing_period_id;
revoke all on public.v_prevalidacion_facturacion from anon;
revoke all on public.v_prevalidacion_resumen from anon;

-- C4-18: total sugerido del cierre (valor vigente x módulos de pacientes en verde)
create or replace view public.v_cierre_sugerido with (security_invoker = true) as
with pac as (
  select v.billing_period_id, v.patient_id,
         bool_or(v.estado_control = 'rojo') as rojo,
         bool_or(v.estado_control = 'amarillo') as amarillo
  from public.v_prevalidacion_facturacion v
  group by v.billing_period_id, v.patient_id
), pac2 as (
  select p.billing_period_id,
         count(*) filter (where not p.rojo and not p.amarillo) as modulos_verdes,
         count(*) filter (where not p.rojo and p.amarillo) as modulos_en_curso,
         count(*) filter (where p.rojo and x.id is null) as pacientes_rojos,
         count(*) filter (where p.rojo and x.id is not null) as pacientes_excluidos
  from pac p
  left join public.billing_period_exclusions x on x.billing_period_id = p.billing_period_id and x.patient_id = p.patient_id
  group by p.billing_period_id
), val as (
  select bp.id as billing_period_id, bp.obra_social_id, os.modalidad_facturacion,
         coalesce((select h.valor from public.obra_social_value_history h
                   where h.obra_social_id = bp.obra_social_id and h.vigente_desde <= (bp.periodo + interval '1 mon -1 days')::date
                   order by h.vigente_desde desc, h.id desc limit 1), os.valor_modulo) as valor_vigente
  from public.billing_periods bp join public.obras_sociales os on os.id = bp.obra_social_id
)
select val.billing_period_id, val.obra_social_id, val.modalidad_facturacion, val.valor_vigente,
       coalesce(p2.modulos_verdes, 0) as modulos_verdes,
       coalesce(p2.modulos_en_curso, 0) as modulos_en_curso,
       coalesce(p2.pacientes_rojos, 0) as pacientes_rojos,
       coalesce(p2.pacientes_excluidos, 0) as pacientes_excluidos,
       case when val.modalidad_facturacion = 'prestaciones' then null else val.valor_vigente * coalesce(p2.modulos_verdes, 0) end as total_sugerido,
       case when val.modalidad_facturacion = 'prestaciones' then null else val.valor_vigente * (coalesce(p2.modulos_verdes, 0) + coalesce(p2.modulos_en_curso, 0)) end as total_proyectado
from val left join pac2 p2 on p2.billing_period_id = val.billing_period_id;
revoke all on public.v_cierre_sugerido from anon;

-- C4-25 y C4-19: firma, conformidad y visitas sin evolución, por paciente y período
create or replace view public.v_prevalidacion_controles with (security_invoker = true) as
select bp.id as billing_period_id, p.id as patient_id, p.nombre_completo,
       coalesce(ev.total, 0::bigint) as evoluciones_mes,
       coalesce(ev.sin_firma, 0::bigint) as sin_firma_profesional,
       coalesce(ev.sin_conf, 0::bigint) as sin_conformidad_familiar,
       coalesce(vs.n, 0::bigint) as visitas_sin_evolucion
from public.billing_periods bp
join public.patients p on p.obra_social_id = bp.obra_social_id
left join lateral (
  select count(*) as total,
         count(*) filter (where e.firma_profesional_at is null) as sin_firma,
         count(*) filter (where e.conformidad_familiar is not true) as sin_conf
  from public.evolutions e
  where e.patient_id = p.id
    and (e.created_at at time zone 'America/Argentina/San_Juan')::date between bp.periodo and (bp.periodo + interval '1 mon -1 days')::date
) ev on true
left join lateral (
  select count(*) as n from public.v_visit_evolution_discrepancies d
  where d.patient_id = p.id
    and (d.fecha_programada at time zone 'America/Argentina/San_Juan')::date between bp.periodo and (bp.periodo + interval '1 mon -1 days')::date
) vs on true
where coalesce(ev.total, 0) > 0 or coalesce(vs.n, 0) > 0;
revoke all on public.v_prevalidacion_controles from anon;

-- C4-27: insumos y equipos entregados vs autorizados en el mes
create or replace view public.v_prevalidacion_insumos with (security_invoker = true) as
with meses as (
  select bp.id as bpid, bp.obra_social_id, bp.periodo as ms, (bp.periodo + interval '1 mon -1 days')::date as me from public.billing_periods bp
), aut as (
  select m.bpid, p.id as patient_id, pa.product_id, sum(pa.cantidad_autorizada)::integer as cant
  from meses m
  join public.patients p on p.obra_social_id = m.obra_social_id
  join public.patient_authorizations pa on pa.patient_id = p.id
  where pa.vigente_desde <= m.me and (pa.vigente_hasta is null or pa.vigente_hasta >= m.ms)
  group by m.bpid, p.id, pa.product_id
), ent as (
  select m.bpid, o.patient_id, oi.product_id, sum(oi.cantidad)::integer as cant
  from meses m
  join public.patients p on p.obra_social_id = m.obra_social_id
  join public.orders o on o.patient_id = p.id and o.estado in ('despachado', 'entregado')
  join public.order_items oi on oi.order_id = o.id
  where (coalesce((select min(r.fecha_despacho) from public.remitos r where r.order_id = o.id), o.created_at) at time zone 'America/Argentina/San_Juan')::date between m.ms and m.me
  group by m.bpid, o.patient_id, oi.product_id
)
select coalesce(a.bpid, e.bpid) as billing_period_id,
       coalesce(a.patient_id, e.patient_id) as patient_id,
       pt.nombre_completo,
       coalesce(a.product_id, e.product_id) as product_id,
       pr.codigo, pr.descripcion, pr.tipo::text as tipo,
       coalesce(a.cant, 0) as cantidad_autorizada,
       coalesce(e.cant, 0) as cantidad_entregada,
       case when coalesce(a.cant, 0) = 0 and coalesce(e.cant, 0) > 0 then 'sin_autorizacion'
            when coalesce(e.cant, 0) > coalesce(a.cant, 0) then 'excedido'
            when coalesce(e.cant, 0) = coalesce(a.cant, 0) then 'ok'
            else 'menor' end as estado_control
from aut a
full join ent e on e.bpid = a.bpid and e.patient_id = a.patient_id and e.product_id = a.product_id
join public.patients pt on pt.id = coalesce(a.patient_id, e.patient_id)
join public.products pr on pr.id = coalesce(a.product_id, e.product_id);
revoke all on public.v_prevalidacion_insumos from anon;

-- C4-23: control diario — qué práctica con frecuencia diaria quedó sin evolución ayer
create or replace view public.v_control_frecuencia_diaria with (security_invoker = true) as
with ayer as (select ((now() at time zone 'America/Argentina/San_Juan')::date - 1) as dia)
select ta.id as treatment_authorization_id, p.id as patient_id, p.nombre_completo, ta.practica, ta.especialidad::text as especialidad,
       a.dia as fecha, coalesce(ta.veces_por_dia, 1)::integer as esperadas, coalesce(ev.cnt, 0::bigint) as cargadas
from ayer a
join public.treatment_authorizations ta on ta.frecuencia_tipo = 'diaria' and ta.periodo_desde <= a.dia and ta.periodo_hasta >= a.dia
join public.patients p on p.id = ta.patient_id and p.estado = 'activo'
left join lateral (
  select count(*) as cnt from public.evolutions e
  where e.patient_id = p.id and e.especialidad = ta.especialidad
    and (e.created_at at time zone 'America/Argentina/San_Juan')::date = a.dia
) ev on true
where (ta.dias_semana is null or extract(isodow from a.dia)::int = any (ta.dias_semana))
  and (p.fecha_ingreso is null or p.fecha_ingreso <= a.dia)
  and (p.fecha_egreso is null or p.fecha_egreso >= a.dia)
  and (p.llegada_confirmada_at is null or (p.llegada_confirmada_at at time zone 'America/Argentina/San_Juan')::date <= a.dia)
  and (p.egreso_informado_at is null or (p.egreso_informado_at at time zone 'America/Argentina/San_Juan')::date >= a.dia)
  and coalesce(ev.cnt, 0) < coalesce(ta.veces_por_dia, 1);
revoke all on public.v_control_frecuencia_diaria from anon;

-- C4-24: control semanal — la semana anterior (lunes a domingo) de las prácticas con días fijos
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
where dd.dias > 0 and coalesce(ev.cnt, 0) < dd.dias * coalesce(ta.veces_por_dia, 1);
revoke all on public.v_control_frecuencia_semanal from anon;
