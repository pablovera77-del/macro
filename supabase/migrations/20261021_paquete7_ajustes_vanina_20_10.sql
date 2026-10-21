-- Paquete 7 · Ajustes según la respuesta de Vanina del 20/10/2026 (DF-C2 pregunta 7, agenda de interconsultores, «no me atendieron»).
-- Todo es aditivo y se puede volver a ejecutar sin romper nada.

-- 1) «Prestación realizada» (enfermería): obligatoria, lista de 8 opciones y se puede marcar más de una.
update public.discipline_form_templates t
   set campos = (
     select jsonb_agg(
              case when e->>'clave' = 'prestacion_realizada'
                   then e || jsonb_build_object(
                          'tipo', 'Selección múltiple',
                          'obligatorio', true,
                          'opciones', jsonb_build_array(
                            'Control de signos vitales',
                            'Curación de heridas',
                            'Administración de medicación EV / SC o IM',
                            'Administración de ATB',
                            'Control de SNG',
                            'Colocación de SNG',
                            'Curación de estoma',
                            'Soporte nutricional'))
                   else e end
              order by ord)
       from jsonb_array_elements(t.campos) with ordinality as x(e, ord))
 where t.especialidad = 'enfermeria'
   and exists (select 1 from jsonb_array_elements(t.campos) e where e->>'clave' = 'prestacion_realizada');

-- 2) Medicina: «Motivo de la consulta» y «Examen físico» se mantienen, pero como opcionales.
update public.discipline_form_templates t
   set campos = (
     select jsonb_agg(
              case when coalesce(e->>'clave', '') in ('motivo_de_la_consulta', 'examen_fisico')
                        or e->>'label' in ('Motivo de la consulta', 'Examen físico')
                   then e || jsonb_build_object('obligatorio', false)
                   else e end
              order by ord)
       from jsonb_array_elements(t.campos) with ordinality as x(e, ord))
 where t.especialidad = 'medicina';

-- 3) Aviso «no me atendieron»: llega a Administración y a Coordinación para reprogramar la visita.
insert into public.alert_types (codigo, nombre, descripcion, urgencia, mensaje, canal_app, canal_email, canal_whatsapp, activo)
select 'visita_no_atendida', 'No atendieron al profesional en el domicilio',
       'Un profesional informó que no lo atendieron en el domicilio. Hay que reprogramar la visita.', 'inmediata',
       'No atendieron a {profesional} en el domicilio de {paciente} ({motivo}). Hay que reprogramar la visita.', true, false, false, true
where not exists (select 1 from public.alert_types where codigo = 'visita_no_atendida');

insert into public.alert_type_recipients (alert_type, role)
select 'visita_no_atendida', r::public.app_role
  from unnest(array['administracion', 'coordinador_internacion']) as r
 where not exists (select 1 from public.alert_type_recipients x where x.alert_type = 'visita_no_atendida' and x.role = r::public.app_role);

-- 4) «Mis pacientes» (profesionales sin coordinador): lista de los pacientes asignados con sus datos y la
--    frecuencia autorizada, sin agenda ni contador (acordado con Vanina el 20/10).
--    Un profesional no lee `patients` ni las autorizaciones directamente (RLS): se lo da esta función, que
--    devuelve solo lo mínimo y solo de los pacientes de su propio equipo.
create or replace function public.fn_mis_pacientes()
returns table (
  patient_id uuid,
  nombre_completo text,
  dni text,
  domicilio text,
  localidad text,
  telefono text,
  obra_social text,
  numero_afiliado text,
  diagnostico_principal text,
  especialidad public.specialty,
  frecuencias jsonb,
  visita_hoy uuid,
  ultima_atencion timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  hoy date := (now() at time zone 'America/Argentina/San_Juan')::date;
begin
  if uid is null or public.get_current_app_role() is distinct from 'profesional_asistencial' then
    raise exception 'Solo el profesional asistencial ve su lista de pacientes.';
  end if;
  return query
  select p.id,
         p.nombre_completo,
         p.dni,
         coalesce(nullif(p.domicilio_actual, ''), p.domicilio),
         p.localidad,
         coalesce(nullif(p.telefono_actual, ''), nullif(p.telefono_contacto, ''), p.contacto_familiar_telefono),
         p.obra_social,
         p.numero_afiliado,
         p.diagnostico_principal,
         t.especialidad,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'practica', ta.practica,
                    'aclaracion', ta.practica_aclaracion,
                    'cantidad', ta.frecuencia_cantidad,
                    'unidad', ta.frecuencia_unidad,
                    'periodo', ta.frecuencia_periodo,
                    'dias_semana', ta.dias_semana,
                    'desde', ta.periodo_desde,
                    'hasta', ta.periodo_hasta) order by ta.periodo_hasta desc)
             from public.treatment_authorizations ta
            where ta.patient_id = p.id and ta.especialidad = t.especialidad and ta.periodo_hasta >= hoy
         ), '[]'::jsonb),
         (select v.id from public.visits v
           where v.patient_id = p.id and v.profesional_id = uid and v.estado in ('programada', 'confirmada')
             and (v.fecha_programada at time zone 'America/Argentina/San_Juan')::date = hoy
           order by v.fecha_programada limit 1),
         (select max(coalesce(v.fecha_realizada, v.fecha_programada)) from public.visits v
           where v.patient_id = p.id and v.profesional_id = uid and v.estado = 'realizada')
    from public.patient_care_team t
    join public.patients p on p.id = t.patient_id and p.estado = 'activo'
   where t.profesional_id = uid
   order by p.nombre_completo;
end;
$$;
revoke all on function public.fn_mis_pacientes() from public, anon;
grant execute on function public.fn_mis_pacientes() to authenticated;

-- 5) Atender hoy a un paciente de «Mis pacientes»: crea (o reutiliza) la visita de hoy, sin día ni hora, para que el
--    profesional la vea en «Mi agenda» y siga el circuito de siempre (iniciar, realizada, evolución con las dos firmas).
--    Solo para pacientes de su propio equipo y activos. No cambia lo que programa Coordinación.
create or replace function public.fn_atender_paciente(p_patient uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoy date := (now() at time zone 'America/Argentina/San_Juan')::date;
  esp public.specialty;
  v_id uuid;
begin
  if uid is null or public.get_current_app_role() is distinct from 'profesional_asistencial' then
    raise exception 'Solo el profesional asistencial atiende desde «Mis pacientes».';
  end if;
  select t.especialidad into esp
    from public.patient_care_team t
    join public.patients p on p.id = t.patient_id and p.estado = 'activo'
   where t.patient_id = p_patient and t.profesional_id = uid
   order by t.created_at
   limit 1;
  if esp is null then
    raise exception 'Ese paciente no está en tu lista o todavía no está activo.';
  end if;
  select v.id into v_id
    from public.visits v
   where v.patient_id = p_patient and v.profesional_id = uid and v.estado in ('programada', 'confirmada')
     and (v.fecha_programada at time zone 'America/Argentina/San_Juan')::date = hoy
   order by v.fecha_programada
   limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.visits (patient_id, profesional_id, especialidad, fecha_programada, sin_hora, estado, creado_por, observacion_agenda)
  values (p_patient, uid, esp, (hoy::timestamp at time zone 'America/Argentina/San_Juan'), true, 'programada', uid,
          'Atención iniciada por el profesional desde «Mis pacientes».')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.fn_atender_paciente(uuid) from public, anon;
grant execute on function public.fn_atender_paciente(uuid) to authenticated;
