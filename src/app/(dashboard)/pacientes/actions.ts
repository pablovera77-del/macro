"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

export async function createPatientAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración da de alta pacientes.");

  const supabase = await createClient();
  const nombre_completo = String(formData.get("nombre_completo") || "").trim();
  const domicilio = String(formData.get("domicilio") || "").trim();
  const obra_social = String(formData.get("obra_social") || "").trim() || null;
  const frecuencia_reposicion = String(formData.get("frecuencia_reposicion") || "a_demanda") as Enums<"replenishment_frequency">;

  if (!nombre_completo || !domicilio) throw new Error("Faltan nombre o domicilio.");

  const { error } = await supabase.from("patients").insert({
    nombre_completo,
    domicilio,
    obra_social,
    frecuencia_reposicion,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/pacientes");
  return;
}

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
