-- W5 (C5 Stock) — Solicitud del coordinador y revisión ítem por ítem de Depósito (R05, R06, R07, R03).
-- Copia de lo aplicado en la base. La tabla de avisos se llama order_notices porque
-- `notifications` es del catálogo de alertas (frente de Configuración).
alter table public.orders add column if not exists origen text not null default 'deposito';
alter table public.orders add constraint orders_origen_check check (origen in ('deposito','solicitud'));

alter table public.order_items
  add column if not exists estado_item text not null default 'aceptado',
  add column if not exists motivo text,
  add column if not exists cantidad_solicitada int,
  add column if not exists revisado_por uuid references public.profiles(id),
  add column if not exists revisado_at timestamptz;
alter table public.order_items add constraint order_items_estado_item_check check (estado_item in ('pendiente','aceptado','ajustado','rechazado'));

create table public.order_notices (
  id bigint generated always as identity primary key,
  rol_destino public.app_role,
  user_destino uuid references public.profiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  detalle text,
  href text,
  order_id uuid references public.orders(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  leido_at timestamptz,
  leido_por uuid references public.profiles(id) on delete set null,
  constraint order_notices_destino_check check (rol_destino is not null or user_destino is not null)
);
create index order_notices_rol_idx on public.order_notices (rol_destino, leido_at);
create index order_notices_user_idx on public.order_notices (user_destino, leido_at);
alter table public.order_notices enable row level security;
revoke all on public.order_notices from anon;
revoke update on public.order_notices from authenticated;
grant update (leido_at, leido_por) on public.order_notices to authenticated;
create policy select_order_notices on public.order_notices for select
  using (public.get_current_app_role() is not null and (user_destino = auth.uid() or (user_destino is null and rol_destino = public.get_current_app_role())));
create policy insert_order_notices on public.order_notices for insert
  with check (public.get_current_app_role() in ('administracion','coordinador_internacion','deposito','transporte','profesional_asistencial') and creado_por = auth.uid());
create policy update_order_notices on public.order_notices for update
  using (public.get_current_app_role() is not null and (user_destino = auth.uid() or (user_destino is null and rol_destino = public.get_current_app_role())))
  with check (leido_por = auth.uid());

-- Coordinación crea solicitudes (pedido en borrador con origen 'solicitud') y puede cancelar las suyas.
create policy insert_orders_solicitud_coordinador on public.orders for insert
  with check (public.get_current_app_role() = 'coordinador_internacion' and origen = 'solicitud' and estado = 'borrador' and creado_por = auth.uid());
create policy cancel_orders_solicitud_coordinador on public.orders for update
  using (public.get_current_app_role() = 'coordinador_internacion' and origen = 'solicitud' and estado = 'borrador' and creado_por = auth.uid())
  with check (estado = 'cancelado');
create policy insert_order_items_solicitud_coordinador on public.order_items for insert
  with check (public.get_current_app_role() = 'coordinador_internacion' and estado_item = 'pendiente'
    and exists (select 1 from public.orders o where o.id = order_id and o.creado_por = auth.uid() and o.origen = 'solicitud' and o.estado = 'borrador'));
-- Depósito revisa ítem por ítem.
create policy update_order_items_deposito on public.order_items for update
  using (public.get_current_app_role() = 'deposito') with check (public.get_current_app_role() = 'deposito');

-- Un ítem rechazado no descuenta stock al despachar.
create or replace function public.fn_log_stock_movement_on_dispatch()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.estado = 'despachado' and (old.estado is distinct from 'despachado') then
    insert into public.stock_movements (product_id, tipo, cantidad, motivo, order_id, confirmado_por, fecha)
    select oi.product_id, 'egreso_entrega', oi.cantidad,
           'Despacho automático de pedido ' || new.id::text,
           new.id, new.autorizado_por, coalesce(new.fecha_autorizacion, now())
    from public.order_items oi
    where oi.order_id = new.id
      and oi.equipment_asset_id is null
      and oi.estado_item <> 'rechazado';
  end if;
  return new;
end;
$function$;
