-- Frente Facturación (C4) — copia de lo aplicado en la base. Solo cambios aditivos.

-- 1) Configuración de obra social (C4-05, 06, 10)
alter table public.obras_sociales
  add column if not exists reglas_facturacion text,
  add column if not exists modalidad_facturacion text,
  add column if not exists auditoria_contacto_nombre text,
  add column if not exists auditoria_contacto_telefono text,
  add column if not exists auditoria_contacto_email text;
alter table public.obras_sociales add constraint obras_sociales_modalidad_facturacion_check
  check (modalidad_facturacion is null or modalidad_facturacion in ('modulos','prestaciones'));

-- 2) Frecuencia estructurada de la autorización de práctica (C4-21, 23, 24)
alter table public.treatment_authorizations
  add column if not exists frecuencia_tipo text,
  add column if not exists dias_semana smallint[],
  add column if not exists veces_por_dia smallint;
alter table public.treatment_authorizations
  add constraint treatment_authorizations_frecuencia_tipo_check check (frecuencia_tipo is null or frecuencia_tipo in ('diaria','semanal')),
  add constraint treatment_authorizations_dias_semana_check check (dias_semana is null or dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]),
  add constraint treatment_authorizations_veces_por_dia_check check (veces_por_dia is null or veces_por_dia between 1 and 10);

-- 3) Resubmisión de débitos (C4-44)
alter table public.billing_debits
  add column if not exists reclamable boolean not null default false,
  add column if not exists fecha_resubmision date,
  add column if not exists resubmision_notas text;

-- 4) Pacientes dejados fuera de un cierre (C4-38)
create table if not exists public.billing_period_exclusions (
  id bigint generated always as identity primary key,
  billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  motivo text,
  excluido_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (billing_period_id, patient_id)
);
alter table public.billing_period_exclusions enable row level security;
revoke all on public.billing_period_exclusions from anon;
create policy select_authenticated on public.billing_period_exclusions for select using (public.get_current_app_role() is not null);
create policy write_exclusions_admin on public.billing_period_exclusions for insert with check (public.get_current_app_role() = 'administracion');
create policy delete_exclusions_admin on public.billing_period_exclusions for delete using (public.get_current_app_role() = 'administracion');
create trigger trg_audit_billing_period_exclusions after insert or update or delete on public.billing_period_exclusions for each row execute function public.fn_audit_log();

-- 5) Presupuestos de venta (C4-15, 16)
create table if not exists public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  obra_social_id uuid references public.obras_sociales(id),
  destinatario_particular text,
  fecha date not null default ((now() at time zone 'America/Argentina/San_Juan')::date),
  validez_dias integer not null default 15 check (validez_dias > 0 and validez_dias <= 365),
  notas text,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint sales_quotes_destinatario_check check (obra_social_id is not null or length(btrim(coalesce(destinatario_particular, ''))) > 0)
);
create unique index if not exists sales_quotes_numero_key on public.sales_quotes (numero);
create table if not exists public.sales_quote_items (
  id bigint generated always as identity primary key,
  quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  descripcion text not null check (length(btrim(descripcion)) > 0),
  cantidad numeric(10,2) not null check (cantidad > 0),
  valor_unitario numeric(14,2) not null check (valor_unitario >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sales_quote_items_quote_idx on public.sales_quote_items (quote_id);
alter table public.sales_quotes enable row level security;
alter table public.sales_quote_items enable row level security;
revoke all on public.sales_quotes from anon;
revoke all on public.sales_quote_items from anon;
create policy select_authenticated on public.sales_quotes for select using (public.get_current_app_role() is not null);
create policy write_sales_quotes_admin on public.sales_quotes for all using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
create policy select_authenticated on public.sales_quote_items for select using (public.get_current_app_role() is not null);
create policy write_sales_quote_items_admin on public.sales_quote_items for all using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
create trigger trg_audit_sales_quotes after insert or update or delete on public.sales_quotes for each row execute function public.fn_audit_log();
create trigger trg_audit_sales_quote_items after insert or update or delete on public.sales_quote_items for each row execute function public.fn_audit_log();
