-- Frente C2 · Agenda y visitas (aplicado a la base el 05/10/2026). Solo cambios aditivos.
--
-- Horario opcional / franja / rango (R08, R09). fecha_programada sigue siendo NOT NULL:
--  - hora exacta:  sin_hora=false, franja null, hora_desde/hasta null (lo de siempre)
--  - solo el día:  sin_hora=true  (fecha_programada = ese día 00:00 de San Juan)
--  - franja:       franja in (manana, tarde, noche) (fecha_programada = inicio de la franja)
--  - rango:        hora_desde/hora_hasta (fecha_programada = ese día a hora_desde)
alter table public.visits
  add column if not exists sin_hora boolean not null default false,
  add column if not exists franja text,
  add column if not exists hora_desde time,
  add column if not exists hora_hasta time;

-- Apertura / cierre de la visita (R12, R13, R14, R62) y recordatorios enviados.
-- "En curso" se deriva: abierta_at no nulo y la visita todavía programada/confirmada.
alter table public.visits
  add column if not exists abierta_at timestamptz,
  add column if not exists cerrada_at timestamptz,
  add column if not exists abierta_lat double precision,
  add column if not exists abierta_lng double precision,
  add column if not exists recordatorio_enviado_at timestamptz;

alter table public.visits
  add constraint visits_franja_chk check (franja is null or franja in ('manana','tarde','noche')),
  add constraint visits_horario_chk check (
    (not sin_hora or (franja is null and hora_desde is null and hora_hasta is null))
    and (franja is null or (hora_desde is null and hora_hasta is null))
    and (hora_hasta is null or hora_desde is null or hora_hasta > hora_desde)
    and ((hora_desde is null) = (hora_hasta is null))
  );

comment on column public.visits.sin_hora is 'Visita de un día sin horario definido (solo la fecha). fecha_programada guarda ese día a las 00:00 de San Juan.';
comment on column public.visits.franja is 'Franja horaria en vez de hora exacta: manana (8 a 14), tarde (16 a 21), noche (desde las 21). fecha_programada guarda el inicio de la franja.';
comment on column public.visits.hora_desde is 'Rango horario: desde (hora de San Juan). fecha_programada guarda ese instante.';
comment on column public.visits.hora_hasta is 'Rango horario: hasta (hora de San Juan).';
comment on column public.visits.abierta_at is 'Cuándo el profesional inició la visita en el domicilio. Dato interno, no se imprime en la historia clínica.';
comment on column public.visits.cerrada_at is 'Cuándo se cerró la visita (realizada o no realizada). Dato interno.';
comment on column public.visits.recordatorio_enviado_at is 'Cuándo Coordinación marcó como enviado el recordatorio de WhatsApp.';
