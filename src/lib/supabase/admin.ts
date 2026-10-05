import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con la clave de servicio de Supabase: se usa SOLO en acciones del servidor y solo para
 * crear cuentas nuevas (Auth no permite crearlas con la clave pública). Si la variable no está
 * cargada en Vercel devuelve null y la pantalla de Usuarios avisa en castellano en vez de fallar.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const puedeCrearUsuarios = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
