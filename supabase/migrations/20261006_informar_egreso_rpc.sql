-- Informar egreso (DF-C3 §11, paso 1): un profesional asistencial no puede escribir en `patients` (RLS),
-- así que el informe se registra con esta función, que valida el rol y que el profesional sea del equipo del paciente.
create or replace function public.fn_informar_egreso(p_patient uuid, p_motivo public.discharge_reason, p_hecho timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.app_role := public.get_current_app_role();
  uid uuid := auth.uid();
begin
  if uid is null or r is null then
    raise exception 'Necesitás iniciar sesión.';
  end if;
  if r not in ('administracion', 'coordinador_internacion', 'profesional_asistencial') then
    raise exception 'Solo un profesional asistencial, Coordinación o Administración pueden informar un egreso.';
  end if;
  if r = 'profesional_asistencial' and not exists (
    select 1 from public.patient_care_team where patient_id = p_patient and profesional_id = uid
  ) then
    raise exception 'Solo el equipo tratante del paciente puede informar su egreso.';
  end if;
  update public.patients
     set egreso_informado_at = now(),
         egreso_informado_por = uid,
         egreso_motivo_informado = p_motivo,
         egreso_hecho_at = least(coalesce(p_hecho, now()), now())
   where id = p_patient and estado = 'activo' and egreso_informado_at is null;
  if not found then
    raise exception 'El paciente no está activo o ya tiene un egreso informado.';
  end if;
end;
$$;
revoke all on function public.fn_informar_egreso(uuid, public.discharge_reason, timestamptz) from public, anon;
grant execute on function public.fn_informar_egreso(uuid, public.discharge_reason, timestamptz) to authenticated;
