"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums, TablesUpdate } from "@/types/database";

const BILLING_ROLES: Enums<"app_role">[] = ["administracion", "direccion"];

// DF-C4 §4: abre el período de cierre mensual para una obra social.
export async function createBillingPeriodAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración gestiona la facturación.");

  const supabase = await createClient();
  const obra_social_id = String(formData.get("obra_social_id") || "");
  const periodo = String(formData.get("periodo") || "");
  const total_facturado = formData.get("total_facturado") ? Number(formData.get("total_facturado")) : null;

  if (!obra_social_id || !periodo) throw new Error("Faltan datos del período.");

  const { error } = await supabase.from("billing_periods").insert({
    obra_social_id,
    periodo: `${periodo}-01`,
    total_facturado,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  return;
}

// Semáforo de cierre: abierto -> en_revision -> cerrado -> facturado (DF-C4 §4).
export async function advanceBillingPeriodAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const nuevo_estado = String(formData.get("nuevo_estado") || "") as Enums<"billing_period_status">;
  if (!billing_period_id || !nuevo_estado) throw new Error("Faltan datos.");

  const patch: TablesUpdate<"billing_periods"> = { estado: nuevo_estado };
  if (nuevo_estado === "cerrado") {
    patch.fecha_cierre = new Date().toISOString();
    patch.cerrado_por = profile.id;
  }

  const { error } = await supabase.from("billing_periods").update(patch).eq("id", billing_period_id);
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  return;
}

// DF-C4 §6: gestión de débitos/glosas de obra social.
export async function addBillingDebitAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const patient_id = String(formData.get("patient_id") || "") || null;
  const motivo = String(formData.get("motivo") || "").trim();
  const monto = Number(formData.get("monto") || 0);

  if (!billing_period_id || !motivo || !monto) throw new Error("Faltan datos del débito.");

  const { error } = await supabase.from("billing_debits").insert({ billing_period_id, patient_id, motivo, monto, gestionado_por: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  return;
}

export async function updateDebitStatusAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const debit_id = Number(formData.get("debit_id"));
  const estado = String(formData.get("estado") || "") as Enums<"debit_status">;
  if (!debit_id || !estado) throw new Error("Faltan datos.");

  const { error } = await supabase.from("billing_debits").update({ estado, gestionado_por: profile.id }).eq("id", debit_id);
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  return;
}
