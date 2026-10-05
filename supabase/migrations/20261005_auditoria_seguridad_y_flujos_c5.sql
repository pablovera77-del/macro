-- Copia de documentación de lo aplicado en la base (auditoría nocturna 04-05/10).
-- 1) profiles: nadie cambia su propio rol/estado; solo el nombre.
alter policy update_own_profile on public.profiles using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke all on public.audit_log from anon;

-- 2) Cuenta desactivada = sin rol = sin acceso.
create or replace function public.get_current_app_role()
 returns app_role language sql stable security definer set search_path to 'public'
as $$ select role from public.profiles where id = auth.uid() and active is not false; $$;

-- Políticas de lectura "cualquier autenticado" -> exigen cuenta activa con perfil.
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname='public' and qual = '(auth.uid() IS NOT NULL)' loop
    execute format('alter policy %I on %I.%I using (public.get_current_app_role() is not null)',
                   r.policyname, r.schemaname, r.tablename);
  end loop; end $$;

-- 3) Dirección solo lee.
alter policy write_billing_debits on public.billing_debits with check (public.get_current_app_role() = 'administracion');
alter policy update_billing_debits on public.billing_debits using (public.get_current_app_role() = 'administracion');
alter policy write_billing_periods on public.billing_periods with check (public.get_current_app_role() = 'administracion');
alter policy update_billing_periods on public.billing_periods using (public.get_current_app_role() = 'administracion');
alter policy write_administracion on public.obra_social_value_history with check (public.get_current_app_role() = 'administracion');
alter policy write_administracion on public.obras_sociales with check (public.get_current_app_role() = 'administracion');
alter policy update_administracion on public.obras_sociales using (public.get_current_app_role() = 'administracion');
alter policy write_templates on public.discipline_form_templates with check (public.get_current_app_role() = 'administracion');
alter policy update_templates on public.discipline_form_templates using (public.get_current_app_role() = 'administracion');

-- 4) Autorizaciones de tratamiento: Administración.
alter policy write_autorizaciones on public.treatment_authorizations with check (public.get_current_app_role() = 'administracion');
alter policy update_autorizaciones on public.treatment_authorizations using (public.get_current_app_role() = 'administracion');

-- 5) C5: flujos que fallaban por RLS (remito al despachar, entrega firmada, retiro y llegada).
create policy insert_remitos_deposito on public.remitos for insert with check (public.get_current_app_role() = 'deposito');
create policy update_remitos_deposito on public.remitos for update using (public.get_current_app_role() = 'deposito');
create policy update_orders_transporte_entrega on public.orders for update
  using (public.get_current_app_role() = 'transporte' and estado = 'despachado' and canal_entrega = 'domicilio')
  with check (estado = 'entregado');
create policy update_discharge_alerts_transporte on public.discharge_alerts for update
  using (public.get_current_app_role() = 'transporte') with check (estado in ('retiro_informado','cerrado'));
create policy select_discharge_alerts on public.discharge_alerts for select using (public.get_current_app_role() is not null);
