-- C2 · Control de la historia clínica (R68-R71). Vistas nuevas; no se tocan las existentes.
set lock_timeout = '5s';

-- Evoluciones a las que les falta la firma del profesional o la conformidad de la familia.
create or replace view public.v_hc_sin_firmas with (security_invoker = true) as
select e.id as evolution_id, e.visit_id, e.patient_id, e.profesional_id, e.especialidad, e.created_at,
       (e.firma_profesional_at is null) as falta_firma_profesional,
       (e.conformidad_familiar is not true) as falta_conformidad
from public.evolutions e
where e.firma_profesional_at is null or e.conformidad_familiar is not true;
revoke all on public.v_hc_sin_firmas from anon;
grant select on public.v_hc_sin_firmas to authenticated;

-- Visitas realizadas vs plan de tratamiento en la última semana completa (lunes a domingo, hora de San Juan).
-- Esperadas: "N por semana" = N; "N por día" = N por cada día indicado (7 si no se indicaron días).
-- Solo pacientes con plan activo; muestra únicamente las semanas que no coinciden (defecto o exceso).
create or replace view public.v_hc_visitas_vs_plan with (security_invoker = true) as
with sem as (
  select (date_trunc('week', (now() at time zone 'America/Argentina/San_Juan')) - interval '7 days')::date as desde
),
plan as (
  select p.patient_id, p.especialidad,
         sum(case when p.unidad = 'semana' then p.cantidad else p.cantidad * coalesce(nullif(cardinality(p.dias_semana), 0), 7) end)::int as esperadas
  from public.treatment_plans p cross join sem
  where p.activo and p.desde <= sem.desde + 6 and (p.hasta is null or p.hasta >= sem.desde)
  group by p.patient_id, p.especialidad
),
real as (
  select v.patient_id, v.especialidad, count(*)::int as realizadas
  from public.visits v cross join sem
  where v.estado = 'realizada'
    and (coalesce(v.fecha_realizada, v.fecha_programada) at time zone 'America/Argentina/San_Juan')::date between sem.desde and sem.desde + 6
  group by v.patient_id, v.especialidad
)
select pl.patient_id, pl.especialidad, sem.desde as semana_desde, pl.esperadas, coalesce(r.realizadas, 0) as realizadas,
       case when coalesce(r.realizadas, 0) > pl.esperadas then 'exceso' else 'defecto' end as estado
from plan pl cross join sem
left join real r on r.patient_id = pl.patient_id and r.especialidad = pl.especialidad
where coalesce(r.realizadas, 0) <> pl.esperadas;
revoke all on public.v_hc_visitas_vs_plan from anon;
grant select on public.v_hc_visitas_vs_plan to authenticated;
