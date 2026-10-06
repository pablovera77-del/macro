-- Paquete 2 (feedback de Vanina, 06/10): H3 autorizaciones estandarizadas y H4 renovación con historial.
-- Aplicada en producción con execute_sql (apply_migration expira por tiempo).
alter table public.treatment_authorizations
  add column if not exists practica_tipo text,
  add column if not exists practica_aclaracion text,
  add column if not exists frecuencia_cantidad smallint,
  add column if not exists frecuencia_unidad text,
  add column if not exists frecuencia_periodo text,
  add column if not exists renueva_a bigint references public.treatment_authorizations(id) on delete set null;

alter table public.treatment_authorizations
  add constraint ta_frec_cantidad_chk check (frecuencia_cantidad is null or frecuencia_cantidad between 1 and 30) not valid,
  add constraint ta_frec_unidad_chk check (frecuencia_unidad is null or frecuencia_unidad in ('visita','sesion','horas')) not valid,
  add constraint ta_frec_periodo_chk check (frecuencia_periodo is null or frecuencia_periodo in ('dia','semana','quincena','mes')) not valid;
create index if not exists ta_renueva_a_idx on public.treatment_authorizations(renueva_a);
