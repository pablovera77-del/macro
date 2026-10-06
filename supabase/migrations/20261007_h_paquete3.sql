-- Paquete 3 (feedback de Vanina, 06/10): H8 séptimo rol «facturacion» y corte administrativo «listo para facturar».
-- Aplicada en producción con execute_sql (apply_migration expira por tiempo).
alter type public.app_role add value if not exists 'facturacion';

-- Períodos abiertos y débitos: solo Facturación (escribe) y Dirección (lee).
alter policy select_authenticated on public.billing_periods using (public.get_current_app_role() in ('facturacion','direccion'));
alter policy select_authenticated on public.billing_debits using (public.get_current_app_role() in ('facturacion','direccion'));
alter policy select_authenticated on public.billing_period_exclusions using (public.get_current_app_role() in ('facturacion','direccion','administracion'));
alter policy update_billing_periods on public.billing_periods using (public.get_current_app_role() = 'facturacion');
alter policy write_billing_periods on public.billing_periods with check (public.get_current_app_role() = 'facturacion');
alter policy update_billing_debits on public.billing_debits using (public.get_current_app_role() = 'facturacion');
alter policy write_billing_debits on public.billing_debits with check (public.get_current_app_role() = 'facturacion');
alter policy delete_exclusions_admin on public.billing_period_exclusions using (public.get_current_app_role() = 'facturacion');
alter policy write_exclusions_admin on public.billing_period_exclusions with check (public.get_current_app_role() = 'facturacion');

-- Valores de obras sociales y presupuestos: Facturación.
alter policy write_administracion on public.obra_social_value_history with check (public.get_current_app_role() in ('administracion','facturacion'));
alter policy update_administracion on public.obras_sociales using (public.get_current_app_role() in ('administracion','facturacion'));
alter policy write_sales_quotes_admin on public.sales_quotes using (public.get_current_app_role() = 'facturacion') with check (public.get_current_app_role() = 'facturacion');
alter policy write_sales_quote_items_admin on public.sales_quote_items using (public.get_current_app_role() = 'facturacion') with check (public.get_current_app_role() = 'facturacion');

-- Facturación lee historias clínicas (para controlar) y la agenda de Transporte.
alter policy select_authenticated on public.evolutions using (public.get_current_app_role() in ('administracion','coordinador_internacion','profesional_asistencial','direccion','facturacion'));
alter policy select_notes on public.evolution_notes using (public.get_current_app_role() in ('administracion','coordinador_internacion','profesional_asistencial','direccion','facturacion'));
alter policy select_transport_tasks on public.transport_tasks using (public.get_current_app_role() in ('transporte','deposito','administracion','direccion','facturacion'));
alter policy select_transport_task_runs on public.transport_task_runs using (public.get_current_app_role() in ('transporte','deposito','administracion','direccion','facturacion'));

-- Corte administrativo mensual por paciente (no es una baja).
create table if not exists public.billing_ready (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  periodo date not null,
  marcado_por uuid references public.profiles(id),
  marcado_at timestamptz not null default now(),
  nota text,
  revisado_por uuid references public.profiles(id),
  revisado_at timestamptz,
  unique (patient_id, periodo)
);
alter table public.billing_ready enable row level security;
create policy select_billing_ready on public.billing_ready for select using (public.get_current_app_role() in ('administracion','facturacion','direccion'));
create policy insert_billing_ready on public.billing_ready for insert with check (public.get_current_app_role() = 'administracion');
create policy update_billing_ready on public.billing_ready for update using (public.get_current_app_role() in ('administracion','facturacion')) with check (public.get_current_app_role() in ('administracion','facturacion'));
create policy delete_billing_ready on public.billing_ready for delete using (public.get_current_app_role() = 'administracion');
create trigger trg_audit_billing_ready after insert or update or delete on public.billing_ready for each row execute function public.fn_audit_log();
