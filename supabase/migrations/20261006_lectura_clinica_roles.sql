-- Las evoluciones y sus notas son datos clínicos: Depósito y Transporte no las leen, ni siquiera por la API.
alter policy select_authenticated on public.evolutions
  using (public.get_current_app_role() in ('administracion', 'coordinador_internacion', 'profesional_asistencial', 'direccion'));
alter policy select_notes on public.evolution_notes
  using (public.get_current_app_role() in ('administracion', 'coordinador_internacion', 'profesional_asistencial', 'direccion'));
