-- Frente Facturación (C4) — vistas de pre-validación. Las existentes solo ganan columnas al final.
-- Hora de referencia: San Juan (America/Argentina/San_Juan).

-- C4-28/32/33/21/20: v_prevalidacion_facturacion (mismas 16 columnas de siempre + controles nuevos al final)
create or replace view public.v_prevalidacion_facturacion as
with overlap as (
  select bp.id as billing_period_id, bp.obra_social_id, bp.periodo, p.id as patient_id, p.nombre_completo,
         ta.id as treatment_authorization_id, ta.practica, ta.especialidad, ta.cantidad_autorizada,
         ta.periodo_desde, ta.periodo_hasta,
         greatest(ta.periodo_desde, bp.periodo) as overlap_desde,
         least(ta.periodo_hasta, (bp.periodo + '1 mon -1 days'::interval)::date) as overlap_hasta,
         p.estado::text as paciente_estado, p.fecha_ingreso as paciente_fecha_ingreso, p.fecha_egreso as paciente_fecha_egreso,
         p.egreso_informado_at, p.llegada_confirmada_at,
         ta.frecuencia_tipo, ta.dias_semana, ta.veces_por_dia
  from billing_periods bp
  join patients p on p.obra_social_id = bp.obra_social_id
  join treatment_authorizations ta on ta.patient_id = p.id
  where ta.periodo_desde <= (bp.periodo + '1 mon -1 days'::interval)::date and ta.periodo_hasta >= bp.periodo
), w1 as (
  select o.*,
         least(o.paciente_fecha_egreso, (o.egreso_informado_at at time zone 'America/Argentina/San_Juan')::date) as dia_corte,
         (o.llegada_confirmada_at at time zone 'America/Argentina/San_Juan')::date as llegada_fecha
  from overlap o
), w2 as (
  select w.*,
         case when w.llegada_fecha is null and w.paciente_estado = 'admitido_pendiente_llegada' then null::date
              else greatest(w.overlap_desde, w.paciente_fecha_ingreso, w.llegada_fecha) end as ventana_desde,
         least(w.overlap_hasta, w.dia_corte) as ventana_hasta
  from w1 w
), w3 as (
  select w.*,
         case when w.ventana_desde is null or w.ventana_hasta < w.ventana_desde then 0
              else (w.ventana_hasta - w.ventana_desde + 1) end as dias_ventana,
         greatest(0, case when w.llegada_fecha is null
                          then case when w.paciente_estado = 'admitido_pendiente_llegada'
                                    then w.overlap_hasta - greatest(w.overlap_desde, coalesce(w.paciente_fecha_ingreso, w.overlap_desde)) + 1
                                    else 0 end
                          else least(w.llegada_fecha, w.overlap_hasta + 1) - greatest(w.overlap_desde, coalesce(w.paciente_fecha_ingreso, w.overlap_desde)) end) as dias_aun_no_llego
  from w2 w
), w4 as (
  select w.*,
         round(w.cantidad_autorizada::numeric * w.dias_ventana::numeric / greatest(1, w.periodo_hasta - w.periodo_desde + 1)::numeric)::integer as esperadas_aj
  from w3 w
), f as (
  select w.*,
         coalesce(ev.cnt, 0::bigint) as ev_mes,
         coalesce(e2.cargadas_ventana, 0::bigint) as ev_ventana,
         coalesce(e2.post_egreso, 0::bigint) as ev_post_egreso,
         coalesce(e2.dia_no_aut, 0::bigint) as ev_dia_no_aut,
         greatest(0::bigint, coalesce(e2.total_aut, 0::bigint) - w.cantidad_autorizada) as ev_exceso,
         e2.primera
  from w4 w
  left join lateral (
    select count(*) as cnt from evolutions e
    where e.patient_id = w.patient_id and e.especialidad = w.especialidad
      and e.created_at::date >= w.overlap_desde and e.created_at::date <= w.overlap_hasta
  ) ev on true
  left join lateral (
    select count(*) filter (where x.d between w.ventana_desde and w.ventana_hasta) as cargadas_ventana,
           count(*) filter (where w.dia_corte is not null and x.d > w.dia_corte and x.d between w.overlap_desde and w.overlap_hasta) as post_egreso,
           count(*) filter (where w.dias_semana is not null and x.d between w.ventana_desde and w.ventana_hasta
                              and not (extract(isodow from x.d)::int = any (w.dias_semana))) as dia_no_aut,
           count(*) filter (where x.d between w.periodo_desde and w.periodo_hasta) as total_aut,
           min(x.d) filter (where x.d between w.ventana_desde and w.ventana_hasta) as primera
    from (select (e.created_at at time zone 'America/Argentina/San_Juan')::date as d
          from evolutions e where e.patient_id = w.patient_id and e.especialidad = w.especialidad) x
  ) e2 on true
)
select f.billing_period_id, f.obra_social_id, f.periodo, f.patient_id, f.nombre_completo, f.treatment_authorization_id,
       f.practica, f.especialidad, f.cantidad_autorizada, f.periodo_desde, f.periodo_hasta, f.overlap_desde, f.overlap_hasta,
       round(f.cantidad_autorizada::numeric * (f.overlap_hasta - f.overlap_desde + 1)::numeric / greatest(1, f.periodo_hasta - f.periodo_desde + 1)::numeric)::integer as evoluciones_esperadas_mes,
       f.ev_mes as evoluciones_cargadas_mes,
       case when f.ev_mes::numeric >= round(f.cantidad_autorizada::numeric * (f.overlap_hasta - f.overlap_desde + 1)::numeric / greatest(1, f.periodo_hasta - f.periodo_desde + 1)::numeric) then 'verde'::text
            when f.overlap_hasta >= current_date then 'amarillo'::text
            else 'rojo'::text end as estado_prevalidacion,
       -- columnas nuevas (controles ampliados)
       f.paciente_estado, f.paciente_fecha_ingreso, f.paciente_fecha_egreso, f.egreso_informado_at, f.llegada_confirmada_at,
       f.frecuencia_tipo, f.dias_semana, f.veces_por_dia,
       f.dia_corte, f.ventana_desde, f.ventana_hasta,
       f.esperadas_aj as evoluciones_esperadas_ajustadas,
       f.ev_ventana as evoluciones_cargadas_ventana,
       f.ev_post_egreso as evoluciones_post_egreso,
       f.ev_dia_no_aut as evoluciones_dia_no_autorizado,
       f.ev_exceso as evoluciones_exceso,
       f.dias_aun_no_llego,
       case when f.dias_ventana = 0 then 0
            else (coalesce(f.primera, f.ventana_hasta + 1) - f.ventana_desde) end as dias_sin_evolucion_inicio,
       case when f.dias_ventana = 0 and f.dias_aun_no_llego > 0 then 'aun_no_llego'::text
            when f.ev_ventana < f.esperadas_aj then 'sin_evolucion'::text
            else null::text end as motivo_faltante,
       case when f.ev_post_egreso > 0 or f.ev_dia_no_aut > 0 or f.ev_exceso > 0 then 'rojo'::text
            when f.ev_ventana >= f.esperadas_aj then 'verde'::text
            when f.ventana_hasta >= (now() at time zone 'America/Argentina/San_Juan')::date then 'amarillo'::text
            else 'rojo'::text end as estado_control
from f;
