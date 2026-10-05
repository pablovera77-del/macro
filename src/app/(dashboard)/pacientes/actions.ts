"use server";

import { hoyAR } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { avisar } from "@/lib/order-notices";
import type { Enums } from "@/types/database";

// El alta de pacientes se hace desde Internación (createAdmissionAction,
// DF-C3), con el legajo completo — no desde acá. Antes existía un
// createPatientAction paralelo con 4 campos que podía generar un
// registro duplicado/incompleto frente al que arma Internación sobre la
// misma tabla `patients`; se sacó para que haya un único punto de alta.

// Carga de equipo/descartables autorizados (DF-C5 §4, paso 1) — dispara
// la visibilidad del pedido para Depósito.
export async function addAuthorizationAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración carga autorizaciones.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const product_id = String(formData.get("product_id") || "");
  const cantidad_autorizada = Number(formData.get("cantidad_autorizada") || 1);
  const vigente_hasta = String(formData.get("vigente_hasta") || "") || null;

  if (!patient_id || !product_id) throw new Error("Faltan paciente o producto.");

  const { error } = await supabase.from("patient_authorizations").insert({
    patient_id,
    product_id,
    cantidad_autorizada,
    vigente_hasta,
    cargado_por: profile.id,
  });

  if (error) throw new Error(error.message);

  // R03: la carga avisa a Depósito (queda en su panel de avisos de Pedidos).
  const [{ data: pac }, { data: prod }] = await Promise.all([
    supabase.from("patients").select("nombre_completo").eq("id", patient_id).maybeSingle(),
    supabase.from("products").select("descripcion").eq("id", product_id).maybeSingle(),
  ]);
  await avisar(supabase, profile.id, {
    rol: "deposito",
    tipo: "autorizacion_nueva",
    titulo: `Nueva autorización de stock: ${pac?.nombre_completo ?? "paciente"}`,
    detalle: `${cantidad_autorizada}x ${prod?.descripcion ?? "producto"}${vigente_hasta ? ` (hasta ${vigente_hasta})` : ""}. Ya podés armar el pedido.`,
    href: "/pedidos",
    patient_id,
  });

  revalidatePath("/pacientes");
  await flash("Autorización de stock cargada. Depósito ya puede armar el pedido.");
  return;
}

// DF-C3 §11, PASO 2 del flujo de egreso revisado: Administración confirma la
// baja definitiva que un profesional/coordinación ya informó (reportarEgresoAction,
// internacion/actions.ts). Acá recién se cierra el paciente y se dispara la
// alerta a Depósito (discharge_alerts + checklist de retiro, vínculo con C5).
export async function confirmarEgresoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración confirma la baja definitiva de un paciente.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  if (!patient_id) throw new Error("Falta el paciente.");

  const { data: patient } = await supabase
    .from("patients")
    .select("egreso_motivo_informado")
    .eq("id", patient_id)
    .single();

  const motivo = (String(formData.get("motivo") || "") || patient?.egreso_motivo_informado || "") as Enums<"discharge_reason">;
  if (!motivo) throw new Error("Falta el motivo del egreso.");

  const today = new Date().toISOString();

  const { error: patientError } = await supabase
    .from("patients")
    .update({ estado: "dado_de_baja", motivo_egreso: motivo, fecha_egreso: hoyAR() })
    .eq("id", patient_id);
  if (patientError) throw new Error(patientError.message);

  const { data: alert, error } = await supabase
    .from("discharge_alerts")
    .insert({ patient_id, motivo, generado_por: profile.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: assignedAssets } = await supabase
    .from("v_equipos_en_domicilio")
    .select("asset_id")
    .eq("patient_id", patient_id);

  if (assignedAssets && assignedAssets.length > 0) {
    await supabase.from("retrieval_checklist").insert(
      assignedAssets
        .filter((a) => a.asset_id)
        .map((a) => ({ discharge_alert_id: alert.id, asset_id: a.asset_id as string }))
    );
  }

  revalidatePath("/pacientes");
  revalidatePath("/internacion");
  revalidatePath("/seguimiento");
  await flash("Baja confirmada. Depósito recibió la alerta para retirar los equipos.");
  return;
}
