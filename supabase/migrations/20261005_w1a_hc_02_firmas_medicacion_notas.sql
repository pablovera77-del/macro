-- C2 · Firma real, medicación estructurada, alerta de cambio, inmutabilidad y notas aclaratorias.
-- Todo aditivo: columnas nullable o con default, tablas y políticas nuevas.
set lock_timeout = '5s';

-- Matrícula del profesional (R16): la completa cada profesional al firmar su primera evolución.
alter table public.profiles add column if not exists matricula text;
grant update (matricula) on public.profiles to authenticated;

alter table public.evolutions
  add column if not exists firma_profesional_img text,        -- PNG (data URL) de la firma dibujada
  add column if not exists firma_profesional_nombre text,     -- nombre y matrícula al momento de firmar
  add column if not exists firma_profesional_matricula text,
  add column if not exists firma_lat double precision,
  add column if not exists firma_lng double precision,
  add column if not exists conformidad_nombre text,           -- quién firma por el paciente/familia
  add column if not exists conformidad_firma text,
  add column if not exists conformidad_lat double precision,
  add column if not exists conformidad_lng double precision,
  add column if not exists medicacion jsonb,                  -- [{cantidad, droga, nombre_comercial, dosis, frecuencia}]
  add column if not exists alerta_cambio boolean not null default false,
  add column if not exists alerta_motivo text;

-- Auditoría sin contenido clínico ni imágenes de firma.
create or replace function public.fn_audit_log_clinical()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  quitar text[] := array['respuestas','upp_escala_nova5','medicacion','alerta_motivo','firma_profesional_img','conformidad_firma','texto'];
begin
  insert into public.audit_log (user_id, accion, entidad, entidad_id, payload_antes, payload_despues)
  values (
    auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - quitar else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) - quitar else null end
  );
  return coalesce(new, old);
end; $function$;

-- Una sola evolución por visita.
create unique index if not exists evolutions_visit_id_uniq on public.evolutions (visit_id) where visit_id is not null;

alter table public.evolutions
  add constraint evolutions_firmas_tamano check (
    (firma_profesional_img is null or length(firma_profesional_img) <= 400000)
    and (conformidad_firma is null or length(conformidad_firma) <= 400000)
  ) not valid;

-- R73: una evolución firmada no se puede modificar (la corrección va como nota aclaratoria).
-- Se permite solo cuando no hay usuario de la app (mantenimiento directo en la base).
create or replace function public.fn_evolution_inmutable()
 returns trigger language plpgsql set search_path = public
as $$
begin
  if old.firma_profesional_at is not null and auth.uid() is not null then
    raise exception 'La evolución ya está firmada y no se puede modificar. Agregá una nota aclaratoria.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
create trigger trg_evolutions_inmutable before update on public.evolutions
  for each row execute function public.fn_evolution_inmutable();

-- R36: la alerta de cambio relevante deja un mensaje [ALERTA] en el equipo del paciente.
create or replace function public.fn_evolution_alerta_cambio()
 returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.alerta_cambio is true then
    insert into public.patient_messages (patient_id, autor_id, mensaje)
    values (new.patient_id, new.profesional_id,
      '[ALERTA] Cambio relevante en la medicación o la indicación médica. Motivo: ' || coalesce(nullif(btrim(new.alerta_motivo), ''), 'ver la evolución médica'));
  end if;
  return new;
end; $$;
revoke execute on function public.fn_evolution_alerta_cambio() from public, anon, authenticated;
create trigger trg_evolutions_alerta_cambio after insert on public.evolutions
  for each row execute function public.fn_evolution_alerta_cambio();

-- R74: notas aclaratorias (solo se agregan; no se editan ni se borran).
create table if not exists public.evolution_notes (
  id uuid primary key default gen_random_uuid(),
  evolution_id uuid not null references public.evolutions(id),
  autor_id uuid not null default auth.uid() references public.profiles(id),
  texto text not null check (length(btrim(texto)) > 0 and length(texto) <= 4000),
  created_at timestamptz not null default now()
);
alter table public.evolution_notes enable row level security;
revoke all on public.evolution_notes from anon;
revoke update, delete, truncate on public.evolution_notes from authenticated;
create index if not exists evolution_notes_evolution_idx on public.evolution_notes (evolution_id, created_at);
create policy select_notes on public.evolution_notes for select using (public.get_current_app_role() is not null);
create policy insert_notes on public.evolution_notes for insert with check (
  autor_id = auth.uid() and (
    public.get_current_app_role() = 'coordinador_internacion'
    or (public.get_current_app_role() = 'profesional_asistencial'
        and exists (select 1 from public.evolutions e where e.id = evolution_id and e.profesional_id = auth.uid()))
  )
);
create trigger trg_audit_evolution_notes after insert or update or delete on public.evolution_notes
  for each row execute function public.fn_audit_log_clinical();
