-- Las funciones de trigger no se llaman desde la app: se les quita el permiso de ejecución
-- para anon/authenticated (los triggers siguen funcionando).
revoke execute on function public.apply_stock_movement() from public, anon, authenticated;
revoke execute on function public.fn_log_stock_movement_on_dispatch() from public, anon, authenticated;
