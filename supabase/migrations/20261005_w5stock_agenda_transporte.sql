-- W5 (C5 Stock) — Agenda de Transporte (R58, R60-R65). Copia de lo aplicado en la base.
create table public.transport_tasks (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'otro' check (tipo in ('entrega','retiro','otro')),
  titulo text not null,
  descripcion text,
  fecha date not null default ((now() at time zone 'America/Argentina/San_Juan')::date),
  hora time,
  duracion_min int not null default 30 check (duracion_min > 0),
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  estado text not null default 'pendiente' check (estado in ('pendiente','en_camino','completada','cancelada')),
  permanente boolean not null default false,
  repeticion text check (repeticion in ('diaria','semanal','mensual')),
  dias_semana int[],
  order_id uuid references public.orders(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  direccion text,
  telefono text,
  contacto text,
  creado_por uuid references public.profiles(id) on delete set null,
  iniciada_at timestamptz,
  completada_at timestamptz,
  aviso_en_camino_at timestamptz,
  reprogramada_desde date,
  reprogramaciones int not null default 0,
  nota_reprogramacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transport_tasks_fecha_idx on public.transport_tasks (fecha, estado);
create index transport_tasks_order_idx on public.transport_tasks (order_id);
-- Marca de «hecha ese día» para las tareas permanentes (que se repiten).
create table public.transport_task_runs (
  task_id uuid not null references public.transport_tasks(id) on delete cascade,
  fecha date not null,
  completada_por uuid references public.profiles(id) on delete set null,
  completada_at timestamptz not null default now(),
  nota text,
  primary key (task_id, fecha)
);
alter table public.transport_tasks enable row level security;
alter table public.transport_task_runs enable row level security;
revoke all on public.transport_tasks, public.transport_task_runs from anon;
create policy select_transport_tasks on public.transport_tasks for select
  using (public.get_current_app_role() in ('transporte','deposito','administracion','direccion'));
create policy insert_transport_tasks on public.transport_tasks for insert
  with check (public.get_current_app_role() in ('transporte','deposito'));
create policy update_transport_tasks on public.transport_tasks for update
  using (public.get_current_app_role() in ('transporte','deposito'))
  with check (public.get_current_app_role() in ('transporte','deposito'));
create policy select_transport_task_runs on public.transport_task_runs for select
  using (public.get_current_app_role() in ('transporte','deposito','administracion','direccion'));
create policy insert_transport_task_runs on public.transport_task_runs for insert
  with check (public.get_current_app_role() = 'transporte');
create policy update_transport_task_runs on public.transport_task_runs for update
  using (public.get_current_app_role() = 'transporte') with check (public.get_current_app_role() = 'transporte');
create trigger trg_audit_transport_tasks after insert or update or delete on public.transport_tasks
  for each row execute function public.fn_audit_log();
