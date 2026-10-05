-- Frente W2 — parte 3: búsqueda de pacientes similares, prórrogas de autorizaciones y link de llegada.

-- ===== Búsqueda difusa de duplicados (nombre sin tildes/mayúsculas + teléfono) =====
-- `unaccent` no está instalada: se normaliza con translate. pg_trgm (similitud por trigramas) se instala en `extensions`.
create extension if not exists pg_trgm with schema extensions;
create or replace function public.fn_norm_texto(t text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(lower(translate(coalesce(t,''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;
create or replace function public.fn_digitos(t text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(t,''), '\D', '', 'g')
$$;
create or replace function public.fn_buscar_pacientes_similares(p_nombre text, p_telefono text default null, p_dni text default null)
returns table (id uuid, nombre_completo text, dni text, estado text, nro_historia_clinica bigint, motivo text, puntaje real)
language sql stable set search_path = public, extensions as $$
  with q as (
    select public.fn_norm_texto(p_nombre) as n,
           case when length(public.fn_digitos(p_telefono)) >= 8 then right(public.fn_digitos(p_telefono), 8) end as t
  ), cand as (
    select p.id, p.nombre_completo, p.dni, p.estado::text as estado, p.nro_historia_clinica,
           public.fn_norm_texto(p.nombre_completo) as nn,
           (q.t is not null and q.t in (right(public.fn_digitos(p.telefono_contacto), 8), right(public.fn_digitos(p.contacto_familiar_telefono), 8), right(public.fn_digitos(p.telefono_actual), 8))) as mismo_tel,
           q.n
    from public.patients p cross join q
    where p_dni is null or p.dni <> p_dni
  ), pts as (
    select c.*, similarity(c.nn, c.n) as sim,
           (length(c.n) > 0 and (c.nn = c.n
              or (least(coalesce(array_length(string_to_array(c.n,' '),1),0), coalesce(array_length(string_to_array(c.nn,' '),1),0)) >= 2
                  and (string_to_array(c.n,' ') <@ string_to_array(c.nn,' ') or string_to_array(c.nn,' ') <@ string_to_array(c.n,' ')))
              or similarity(c.nn, c.n) >= 0.6)) as mismo_nombre
    from cand c
  )
  select id, nombre_completo, dni, estado, nro_historia_clinica,
         case when mismo_nombre then 'nombre' else 'telefono' end as motivo,
         case when mismo_nombre then sim else 0.5 end::real as puntaje
  from pts where mismo_nombre or mismo_tel
  order by 7 desc, nombre_completo
  limit 5
$$;
revoke execute on function public.fn_buscar_pacientes_similares(text, text, text) from public, anon;
grant execute on function public.fn_buscar_pacientes_similares(text, text, text) to authenticated;

-- ===== Prórrogas de autorizaciones (pedido, respuesta, nueva fecha) =====
create table public.authorization_extensions (
  id uuid primary key default gen_random_uuid(),
  authorization_id bigint not null references public.treatment_authorizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  pedida_at date not null default current_date,
  respondida_at date,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  nueva_fecha_hasta date,
  fecha_hasta_anterior date,
  nota text,
  gestionada_por uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint authorization_extensions_aprobada_check check (estado <> 'aprobada' or nueva_fecha_hasta is not null)
);
create index authorization_extensions_auth_idx on public.authorization_extensions (authorization_id, created_at desc);
create index authorization_extensions_patient_idx on public.authorization_extensions (patient_id);
alter table public.authorization_extensions enable row level security;
create policy select_prorrogas on public.authorization_extensions for select using (public.get_current_app_role() is not null);
create policy insert_prorrogas on public.authorization_extensions for insert with check (public.get_current_app_role() = 'administracion');
create policy update_prorrogas on public.authorization_extensions for update using (public.get_current_app_role() = 'administracion') with check (public.get_current_app_role() = 'administracion');
revoke all on public.authorization_extensions from anon;
revoke delete, truncate on public.authorization_extensions from authenticated;
create trigger trg_audit_authorization_extensions after insert or update or delete on public.authorization_extensions for each row execute function public.fn_audit_log();
create or replace function public.fn_prorroga_antes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fecha_hasta_anterior is null then
    select periodo_hasta into new.fecha_hasta_anterior from public.treatment_authorizations where id = new.authorization_id;
  end if;
  return new;
end; $$;
create or replace function public.fn_prorroga_despues() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Prórroga aprobada: la autorización pasa a vencer en la nueva fecha (el historial queda en esta tabla).
  if new.estado = 'aprobada' and new.nueva_fecha_hasta is not null and (tg_op = 'INSERT' or old.estado is distinct from 'aprobada') then
    update public.treatment_authorizations set periodo_hasta = new.nueva_fecha_hasta where id = new.authorization_id;
  end if;
  return new;
end; $$;
revoke execute on function public.fn_prorroga_antes() from public, anon, authenticated;
revoke execute on function public.fn_prorroga_despues() from public, anon, authenticated;
create trigger trg_prorroga_antes before insert on public.authorization_extensions for each row execute function public.fn_prorroga_antes();
create trigger trg_prorroga_despues after insert or update on public.authorization_extensions for each row execute function public.fn_prorroga_despues();

-- ===== Link de confirmación de llegada para la familia (token de 48 h, botón único, sin login) =====
create table public.arrival_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz
);
create index arrival_tokens_patient_idx on public.arrival_tokens (patient_id, created_at desc);
alter table public.arrival_tokens enable row level security;
create policy select_arrival_tokens on public.arrival_tokens for select using (public.get_current_app_role() in ('administracion','coordinador_internacion','direccion'));
revoke all on public.arrival_tokens from anon, authenticated;
grant select (id, patient_id, created_by, created_at, expires_at, used_at) on public.arrival_tokens to authenticated;  -- el token en sí no se lee directo

create or replace function public.fn_arrival_link_create(p_patient uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text; v_exp timestamptz;
begin
  if public.get_current_app_role() not in ('administracion','coordinador_internacion') then
    raise exception 'Solo Administración o Coordinación generan el link de llegada.';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and estado = 'admitido_pendiente_llegada') then
    raise exception 'El paciente no está pendiente de llegada.';
  end if;
  -- Un solo link vigente por paciente: el anterior deja de servir.
  update public.arrival_tokens set expires_at = now() where patient_id = p_patient and used_at is null and expires_at > now();
  v_token := encode(gen_random_bytes(18), 'hex');
  insert into public.arrival_tokens (patient_id, token) values (p_patient, v_token) returning expires_at into v_exp;
  return jsonb_build_object('token', v_token, 'expires_at', v_exp);
end; $$;

create or replace function public.fn_arrival_info(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; v_nombre text;
begin
  select * into t from public.arrival_tokens where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalido'); end if;
  select split_part(btrim(nombre_completo), ' ', 1) into v_nombre from public.patients where id = t.patient_id;
  if t.used_at is not null then return jsonb_build_object('ok', true, 'ya_confirmado', true, 'nombre', v_nombre); end if;
  if t.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'vencido'); end if;
  return jsonb_build_object('ok', true, 'ya_confirmado', false, 'nombre', v_nombre);
end; $$;

create or replace function public.fn_arrival_confirm(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.arrival_tokens where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalido'); end if;
  if t.used_at is not null then return jsonb_build_object('ok', true, 'ya_confirmado', true); end if;
  if t.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'vencido'); end if;
  update public.patients set estado = 'activo', llegada_confirmada_at = now()
   where id = t.patient_id and estado = 'admitido_pendiente_llegada';
  update public.arrival_tokens set used_at = now() where id = t.id;
  update public.patient_status_history set observaciones = 'Confirmada por la familia con el link de llegada'
   where id = (select h.id from public.patient_status_history h where h.patient_id = t.patient_id and h.evento = 'llegada' order by h.created_at desc limit 1);
  return jsonb_build_object('ok', true, 'ya_confirmado', false);
end; $$;

revoke execute on function public.fn_arrival_link_create(uuid) from public, anon;
grant execute on function public.fn_arrival_link_create(uuid) to authenticated;
revoke execute on function public.fn_arrival_info(text) from public;
revoke execute on function public.fn_arrival_confirm(text) from public;
grant execute on function public.fn_arrival_info(text) to anon, authenticated;
grant execute on function public.fn_arrival_confirm(text) to anon, authenticated;
