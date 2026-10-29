-- Paquete 9 (30/10/2026): datos del documento de la obra social en la autorización + archivo adjunto.
-- A partir de los modelos de autorización recibidos (Mutual Federada, Provincia, Omint, Sancor, Jerárquicos, OSFATLYF, DAMSU).
-- Idempotente: se puede ejecutar más de una vez.

alter table public.treatment_authorizations
  add column if not exists nro_autorizacion text,
  add column if not exists codigo_practica text,
  add column if not exists auditor_nombre text,
  add column if not exists vencimiento_documento date,
  add column if not exists documento_archivo text,
  add column if not exists documento_nombre text;

comment on column public.treatment_authorizations.nro_autorizacion is 'Número de autorización o solicitud que emite la obra social (se exige para facturar en varias).';
comment on column public.treatment_authorizations.codigo_practica is 'Código de la práctica según la obra social (nomenclador propio de cada una).';
comment on column public.treatment_authorizations.vencimiento_documento is 'Vencimiento del formulario de autorización (distinto del fin del período autorizado).';

-- Archivo del documento original (PDF o imagen, hasta 10 MB). Ruta: <patient_id>/<uuid>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('autorizaciones', 'autorizaciones', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists autorizaciones_doc_select on storage.objects;
create policy autorizaciones_doc_select on storage.objects for select
  using (bucket_id = 'autorizaciones' and public.get_current_app_role() in ('administracion', 'facturacion', 'direccion', 'auditor_externo', 'coordinador_internacion'));
drop policy if exists autorizaciones_doc_insert on storage.objects;
create policy autorizaciones_doc_insert on storage.objects for insert
  with check (bucket_id = 'autorizaciones' and public.get_current_app_role() = 'administracion');
drop policy if exists autorizaciones_doc_delete on storage.objects;
create policy autorizaciones_doc_delete on storage.objects for delete
  using (bucket_id = 'autorizaciones' and public.get_current_app_role() = 'administracion');
