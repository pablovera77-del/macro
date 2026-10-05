-- W3 Configuración · 03 Catálogo de alertas y notificaciones dentro de la app (DF-C1 §4.2; R50-R54)
-- El envío real de mail / WhatsApp queda fuera de alcance: canal_email y canal_whatsapp son solo configuración.

create table if not exists public.alert_types (
  codigo text primary key,
  nombre text not null,
  descripcion text,
  urgencia text not null check (urgencia in ('inmediata', 'digest')),
  canal_app boolean not null default true,
  canal_email boolean not null default false,
  canal_whatsapp boolean not null default false,
  mensaje text not null,
  parametros jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.alert_types enable row level security;
revoke all on public.alert_types from anon;
grant select, update on public.alert_types to authenticated;
create policy alert_types_select on public.alert_types for select using (public.get_current_app_role() is not null);
create policy alert_types_update on public.alert_types for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');

create table if not exists public.alert_type_recipients (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null references public.alert_types (codigo) on delete cascade,
  role public.app_role,
  user_id uuid references public.profiles (id),
  check ((role is not null)::int + (user_id is not null)::int = 1)
);
create unique index if not exists alert_type_recipients_role_uq on public.alert_type_recipients (alert_type, role) where role is not null;
create unique index if not exists alert_type_recipients_user_uq on public.alert_type_recipients (alert_type, user_id) where user_id is not null;
alter table public.alert_type_recipients enable row level security;
revoke all on public.alert_type_recipients from anon;
grant select, insert, delete on public.alert_type_recipients to authenticated;
create policy alert_recipients_select on public.alert_type_recipients for select using (public.get_current_app_role() is not null);
create policy alert_recipients_insert on public.alert_type_recipients for insert with check (public.get_current_app_role() = 'administracion');
create policy alert_recipients_delete on public.alert_type_recipients for delete using (public.get_current_app_role() = 'administracion');

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  alert_type text not null references public.alert_types (codigo),
  mensaje text not null,
  href text,
  entidad text,
  entidad_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid() and public.get_current_app_role() is not null);
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid() and public.get_current_app_role() is not null) with check (user_id = auth.uid());

-- Genera las notificaciones de un tipo: arma el texto con la plantilla editable, resuelve a quién le
-- corresponde (por rol o por persona, más destinatarios puntuales como el responsable de una obra social)
-- y no repite un aviso sin leer sobre lo mismo. Nunca avisa a quien disparó la acción.
create or replace function public.fn_notificar(
  p_tipo text, p_vars jsonb default '{}'::jsonb, p_href text default null,
  p_entidad text default null, p_entidad_id text default null, p_extra_users uuid[] default '{}'
) returns integer
language plpgsql security definer set search_path = public as $$
declare t public.alert_types; msg text; k text; v text; n integer;
begin
  if public.get_current_app_role() is null then return 0; end if;
  select * into t from public.alert_types where codigo = p_tipo;
  if not found or not t.activo or not t.canal_app then return 0; end if;
  msg := t.mensaje;
  for k, v in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    msg := replace(msg, '{' || k || '}', coalesce(v, ''));
  end loop;
  insert into public.notifications (user_id, alert_type, mensaje, href, entidad, entidad_id)
  select distinct pr.id, p_tipo, msg, p_href, p_entidad, p_entidad_id
    from public.profiles pr
   where pr.active and pr.id is distinct from auth.uid()
     and (pr.role in (select r.role from public.alert_type_recipients r where r.alert_type = p_tipo and r.role is not null)
          or pr.id in (select r.user_id from public.alert_type_recipients r where r.alert_type = p_tipo and r.user_id is not null)
          or pr.id = any (coalesce(p_extra_users, '{}')))
     and not exists (select 1 from public.notifications x
                      where x.user_id = pr.id and x.alert_type = p_tipo and x.read_at is null
                        and p_entidad_id is not null and x.entidad_id = p_entidad_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.fn_notificar(text, jsonb, text, text, text, uuid[]) from public, anon;
grant execute on function public.fn_notificar(text, jsonb, text, text, text, uuid[]) to authenticated;

insert into public.alert_types (codigo, nombre, descripcion, urgencia, mensaje) values
  ('egreso_informado', 'Egreso informado sin confirmar', 'Un profesional o Coordinación informó el egreso de un paciente y falta la baja definitiva.', 'inmediata', 'Se informó el egreso de {paciente} ({motivo}). Falta confirmar la baja definitiva.'),
  ('pedido_en_borrador', 'Pedido esperando autorización', 'Depósito armó un pedido que no está cubierto por la autorización del paciente.', 'inmediata', 'Hay un pedido de {paciente} esperando que lo autorices.'),
  ('pedido_no_autorizado', 'Pedido rechazado', 'Administración rechazó un pedido.', 'inmediata', 'Se rechazó el pedido de {paciente}: {motivo}.'),
  ('cambio_medico_relevante', 'Cambio médico relevante', 'Cambio de diagnóstico, medicación o plan que otras personas del equipo tienen que conocer.', 'inmediata', 'Hubo un cambio médico relevante en {paciente}: {detalle}.'),
  ('autorizacion_por_vencer', 'Autorización por vencer', 'Una autorización de práctica entra en el plazo de aviso.', 'digest', 'La autorización de {paciente} vence el {fecha}.'),
  ('ubicacion_no_confirmada', 'Equipo sin confirmar en depósito', 'Un equipo retirado no confirmó su llegada a depósito en el plazo definido.', 'digest', 'El equipo {equipo} salió de {paciente} y todavía no llegó a depósito.'),
  ('conflicto_agenda', 'Conflicto de agenda', 'Un profesional tiene dos visitas superpuestas.', 'digest', '{profesional} tiene visitas superpuestas el {fecha}.'),
  ('cierre_facturacion', 'Cierre de facturación', 'Vence el plazo de presentación de un período.', 'digest', 'El período {periodo} de {obra_social} vence el {fecha}.')
on conflict (codigo) do nothing;

insert into public.alert_type_recipients (alert_type, role) values
  ('egreso_informado', 'administracion'),
  ('pedido_en_borrador', 'administracion'),
  ('pedido_no_autorizado', 'deposito'), ('pedido_no_autorizado', 'coordinador_internacion'),
  ('cambio_medico_relevante', 'coordinador_internacion'), ('cambio_medico_relevante', 'administracion'),
  ('autorizacion_por_vencer', 'administracion'),
  ('ubicacion_no_confirmada', 'deposito'), ('ubicacion_no_confirmada', 'administracion'),
  ('conflicto_agenda', 'coordinador_internacion'),
  ('cierre_facturacion', 'administracion')
on conflict do nothing;
