import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Sb = SupabaseClient<Database>;
type Rol = Database["public"]["Enums"]["app_role"];

// Avisos entre roles del circuito de stock (autorizaciones nuevas, solicitudes, despachos).
// Van a un rol entero (rol) o a una persona puntual (user). Son "mejor esfuerzo": si el
// aviso falla, la acción principal no se cae.
export async function avisar(
  supabase: Sb,
  creadoPor: string,
  a: {
    rol?: Rol;
    user?: string | null;
    tipo: string;
    titulo: string;
    detalle?: string | null;
    href?: string | null;
    order_id?: string | null;
    patient_id?: string | null;
  }
) {
  if (!a.rol && !a.user) return;
  if (a.user && a.user === creadoPor) return;
  await supabase.from("order_notices").insert({
    rol_destino: a.user ? null : a.rol ?? null,
    user_destino: a.user ?? null,
    tipo: a.tipo,
    titulo: a.titulo,
    detalle: a.detalle ?? null,
    href: a.href ?? null,
    order_id: a.order_id ?? null,
    patient_id: a.patient_id ?? null,
    creado_por: creadoPor,
  });
}
