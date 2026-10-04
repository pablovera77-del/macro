"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import type { Enums, TablesUpdate } from "@/types/database";

// TODO(DF-C1 §4.3): este gate asume que "administracion" factura — DF-C4 §2
// corrigió a DF-C1, que hablaba de un rol "Facturación" aparte. Pendiente de
// que Vanina confirme si en la práctica Facturación va a ser un rol de
// sistema propio (con su propio usuario) o sigue siendo una tarea más de
// Administración. Si se confirma como rol aparte, agregarlo acá y en
// facturacion/page.tsx (canManage) — y revisar si también debería poder
// cargar débitos sin pasar por Administración.
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
  await flash("Período abierto. Avanzalo con los botones de su fila.");
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

  // DF-C4 §4, control de pre-validación #1 (el más crítico, según el cliente):
  // no se puede cerrar un período con pacientes en rojo — cantidad de
  // evoluciones cargadas por debajo de lo autorizado dentro del mes. Ver
  // v_prevalidacion_facturacion/v_prevalidacion_resumen (DF-C4 §4).
  if (nuevo_estado === "cerrado") {
    const { data: resumen } = await supabase
      .from("v_prevalidacion_resumen")
      .select("rojos, bloqueado")
      .eq("billing_period_id", billing_period_id)
      .maybeSingle();
    if (resumen?.bloqueado) {
      throw new Error(
        `No se puede cerrar el período: hay ${resumen.rojos} paciente(s) con menos evoluciones cargadas que las autorizadas para este mes. Revisá el detalle en "Pre-validación" antes de cerrar.`
      );
    }
  }

  const patch: TablesUpdate<"billing_periods"> = { estado: nuevo_estado };
  if (nuevo_estado === "cerrado") {
    patch.fecha_cierre = new Date().toISOString();
    patch.cerrado_por = profile.id;
  }
  // DF-C4 §11: Cobrada/Debitada/En gestión, continuación de "facturado"
  // (= Presentada) — se registra cuándo se actualizó el estado de cobro.
  if (nuevo_estado === "cobrada" || nuevo_estado === "debitada" || nuevo_estado === "en_gestion") {
    patch.fecha_cobro = new Date().toISOString().slice(0, 10);
    patch.cobro_actualizado_por = profile.id;
  }

  const { error } = await supabase.from("billing_periods").update(patch).eq("id", billing_period_id);
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  await flash("Período actualizado.");
  return;
}

// DF-C4 §11: registra el monto efectivamente cobrado cuando difiere del
// total facturado (ej. cobro parcial tras un débito).
export async function registerMontoCobradoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const monto_cobrado = Number(formData.get("monto_cobrado") || 0);
  if (!billing_period_id || !monto_cobrado) throw new Error("Faltan datos del cobro.");

  const { error } = await supabase
    .from("billing_periods")
    .update({ monto_cobrado, fecha_cobro: new Date().toISOString().slice(0, 10), cobro_actualizado_por: profile.id })
    .eq("id", billing_period_id);
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  await flash("Monto cobrado registrado.");
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
  await flash("Débito registrado.");
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
  await flash("Débito actualizado.");
  return;
}
