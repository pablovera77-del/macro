-- Rol «auditor externo» (DF-C1 pregunta 1): solo lectura, sin costo. Las políticas de escritura listan roles
-- puntuales, así que el valor nuevo hereda la lectura general (get_current_app_role() is not null) y ninguna escritura.
alter type public.app_role add value if not exists 'auditor_externo';
