"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

const BILLING_ROLES: Enums<"app_role">[] = ["administracion", "direccion"];

// DF-C4 §2: catálogo de obras sociales, cada una con su propio plazo de
// facturación. DF-C1 lista un rol "Facturación (4 personas)" que DF-C3 §2 y
// DF-C4 §2 contradicen (dicen que es Administración, 3 personas, quien lo
// hace) — no lo resolvimos unilateralmente, seguimos DF-C3/DF-C4 acá.
export async function createObraSocialAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración gestiona obras sociales.");

  const supabase = await createClient();
  const nombre = String(formData.get("nombre") || "").trim();
  const cuit = String(formData.get("cuit") || "").trim() || null;
  const dias_para_facturar = Number(formData.get("dias_para_facturar") || 10);
  const valor_modulo = formData.get("valor_modulo") ? Number(formData.get("valor_modulo")) : null;

  if (!nombre) throw new Error("Falta el nombre de la obra social.");

  const { data: os, error } = await supabase
    .from("obras_sociales")
    .insert({ nombre, cuit, dias_para_facturar })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (valor_modulo != null && os) {
    await supabase.from("obra_social_value_history").insert({ obra_social_id: os.id, valor: valor_modulo, cargado_por: profile.id });
    await supabase.from("obras_sociales").update({ valor_modulo }).eq("id", os.id);
  }

  revalidatePath("/obras-sociales");
  return;
}

// DF-C4 §3: histórico de valores — cada carga actualiza el valor vigente sin
// perder el registro anterior.
export async function addValueHistoryAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración carga valores.");

  const supabase = await createClient();
  const obra_social_id = String(formData.get("obra_social_id") || "");
  const valor = Number(formData.get("valor") || 0);
  if (!obra_social_id || !valor) throw new Error("Faltan datos del valor.");

  const { error } = await supabase.from("obra_social_value_history").insert({ obra_social_id, valor, cargado_por: profile.id });
  if (error) throw new Error(error.message);

  await supabase.from("obras_sociales").update({ valor_modulo: valor }).eq("id", obra_social_id);

  revalidatePath("/obras-sociales");
  return;
}
