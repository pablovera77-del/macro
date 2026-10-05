-- W5 (C5 Stock) — Firma y datos de entrega (R42, R08), estado «preparado», urgencia y pedido para profesional
-- (R49, R59, R50), foto y ubicación (R28, R45, R57). Copia de lo aplicado en la base.

-- (llamada aparte, no puede ir en la misma transacción que su uso)
alter type public.order_status add value if not exists 'preparado' before 'despachado';

alter table public.orders
  add column if not exists motivo_urgencia text,
  add column if not exists profesional_id uuid references public.profiles(id),
  add column if not exists fecha_preparado timestamptz,
  add column if not exists preparado_por uuid references public.profiles(id),
  add column if not exists direccion_entrega text;
alter table public.orders alter column patient_id drop not null;   -- un pedido puede ser para un profesional
alter table public.orders add constraint orders_destinatario_check check (patient_id is not null or profesional_id is not null);

alter table public.remitos
  add column if not exists firmante_nombre text,
  add column if not exists firmante_dni text,
  add column if not exists firmante_vinculo text,
  add column if not exists entrega_lat double precision,
  add column if not exists entrega_lng double precision;
-- remitos.firma_familiar_url: los valores viejos son texto (nombre); los nuevos son la firma como imagen PNG (data URL).

alter table public.equipment_asset_movements add column if not exists lat double precision, add column if not exists lng double precision;
alter table public.equipment_asset_photos
  add column if not exists condicion text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists tomada_por uuid references public.profiles(id);

-- Fotos reales: bucket privado «fotos» (en la base queda la ruta `fotos/<carpeta>/<archivo>`; las URL viejas siguen valiendo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos','fotos',false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy fotos_select_roles on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.get_current_app_role() is not null);
create policy fotos_insert_roles on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.get_current_app_role() in ('deposito','transporte','administracion','coordinador_internacion'));
