-- Paquete 5 (Vanina 06/10): H14 «no me atendieron» con foto de fachada.
alter table public.visits add column if not exists motivo_no_atencion text;
alter table public.visits add column if not exists foto_fachada text;
alter table public.visits drop constraint if exists visits_motivo_no_atencion_chk;
alter table public.visits add constraint visits_motivo_no_atencion_chk check (motivo_no_atencion is null or motivo_no_atencion in ('no_atendieron','paciente_ausente','otro'));
create policy fotos_insert_profesional on storage.objects for insert with check (bucket_id = 'fotos' and name like 'visitas/%' and public.get_current_app_role() = 'profesional_asistencial');
