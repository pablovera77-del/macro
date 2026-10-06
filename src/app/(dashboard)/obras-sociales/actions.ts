"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import type { Enums } from "@/types/database";
import type { ActionResult } from "@/lib/facturacion";

const ADMIN_ROLES: Enums<"app_role">[] = ["administracion"];
const BILLING_ROLES: Enums<"app_role">[] = ["facturacion"];

// DF-C4 §2: catálogo de obras sociales, cada una con su propio plazo de
// facturación. DF-C1 lista un rol "Facturación (4 personas)" que DF-C3 §2 y
// DF-C4 §2 contradicen (dicen que es Administración, 3 personas, quien lo
// hace) — no lo resolvimos unilateralmente, seguimos DF-C3/DF-C4 acá.
export async function createObraSocialAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ADMIN_ROLES.includes(profile.role)) throw new Error("Solo Administración gestiona obras sociales.");

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
  await flash("Obra social creada.");
  return;
}

// DF-C3 §2, comentario cliente: cada una de las 3 personas de Administración
// es responsable de un grupo de obras sociales — esto es lo que permite
// rutear hacia esa persona las alertas de vencimiento que se muestran en
// Internación (ver internacion/page.tsx).
export async function assignResponsableAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ADMIN_ROLES.includes(profile.role)) throw new Error("Solo Administración asigna responsables de obra social.");

  const supabase = await createClient();
  const obra_social_id = String(formData.get("obra_social_id") || "");
  const responsable_id = String(formData.get("responsable_id") || "") || null;
  if (!obra_social_id) throw new Error("Falta la obra social.");

  const { error } = await supabase.from("obras_sociales").update({ responsable_id }).eq("id", obra_social_id);
  if (error) throw new Error(error.message);

  revalidatePath("/obras-sociales");
  revalidatePath("/internacion");
  return;
}

// DF-C4 §3: histórico de valores — cada carga actualiza el valor vigente sin
// perder el registro anterior.
export async function addValueHistoryAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Facturación carga valores.");

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

// Paso 6 del alta (DF-C3 §3 y §7): documentación que pide cada obra social. El catálogo es
// configurable porque Administración todavía está relevando la lista completa de cada una.
export async function addRequiredDocAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración configura la documentación requerida.");
  const supabase = await createClient();
  const obra_social_id = String(formData.get("obra_social_id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const obligatorio = formData.get("obligatorio") === "on";
  if (!obra_social_id || !nombre) throw new Error("Falta el nombre del documento.");
  const { count } = await supabase.from("os_required_documents").select("id", { count: "exact", head: true }).eq("obra_social_id", obra_social_id);
  const { error } = await supabase.from("os_required_documents").insert({ obra_social_id, nombre, obligatorio, orden: (count ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath("/obras-sociales");
  await flash("Documento agregado. Se les pide a los pacientes nuevos de esta obra social en el paso 6 del ingreso.");
}

export async function removeRequiredDocAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración configura la documentación requerida.");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.from("os_required_documents").update({ activo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/obras-sociales");
  await flash("Documento quitado de la lista requerida.");
}

// C4-05/06/09/10: reglas propias de facturación, modalidad (por módulos o por prestaciones),
// plazo para presentar y contacto de auditoría de cada obra social.
export async function updateObraSocialConfigAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Facturación configura las reglas de facturación de cada obra social.");

  const supabase = await createClient();
  const obra_social_id = String(formData.get("obra_social_id") || "");
  if (!obra_social_id) return { error: "Falta la obra social. Recargá la página." };

  const modalidadRaw = String(formData.get("modalidad_facturacion") || "");
  if (modalidadRaw && modalidadRaw !== "modulos" && modalidadRaw !== "prestaciones") {
    return { error: "Elegí «Por módulos» o «Por prestaciones» como modalidad de facturación." };
  }
  const dias = Number(formData.get("dias_para_facturar") || 0);
  if (!Number.isInteger(dias) || dias < 0 || dias > 365) return { error: "Los días para facturar tienen que ser un número entero entre 0 y 365." };
  const email = String(formData.get("auditoria_contacto_email") || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email del contacto de auditoría no parece válido. Revisalo (ej. nombre@empresa.com)." };

  const { error } = await supabase
    .from("obras_sociales")
    .update({
      reglas_facturacion: String(formData.get("reglas_facturacion") || "").trim() || null,
      modalidad_facturacion: modalidadRaw || null,
      dias_para_facturar: dias,
      auditoria_contacto_nombre: String(formData.get("auditoria_contacto_nombre") || "").trim() || null,
      auditoria_contacto_telefono: String(formData.get("auditoria_contacto_telefono") || "").trim() || null,
      auditoria_contacto_email: email || null,
    })
    .eq("id", obra_social_id);
  if (error) return { error: `No se pudo guardar la configuración: ${error.message}.` };

  revalidatePath("/obras-sociales");
  revalidatePath("/facturacion");
  await flash("Configuración de la obra social guardada. Se usa en el cierre mensual (plazo y total sugerido).");
  return null;
}
