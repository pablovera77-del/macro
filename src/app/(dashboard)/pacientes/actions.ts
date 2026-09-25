"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/pacientes");
  return;
}
