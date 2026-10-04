"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { DISCIPLINAS_PLAN } from "@/lib/plan";
import type { Enums } from "@/types/database";

const PLAN_ROLES: AppRole[] = ["administracion", "coordinador_internacion"];
const ESPECIALIDADES = new Set<string>(DISCIPLINAS_PLAN);

function refresh(patientId: string) {
  revalidatePath(`/paciente/${patientId}`);
  revalidatePath("/internacion");
  revalidatePath("/agenda");
}

// DF-C3 §4.3: plan de tratamiento por disciplina. Cada cambio conserva el historial:
// el plan anterior se cierra (activo = false, hasta = hoy) y el nuevo apunta a él.
export async function savePlanAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!PLAN_ROLES.includes(profile.role)) throw new Error("Solo Administración o Coordinación modifican el plan de tratamiento.");
  const supabase = await createClient();

  const patient_id = String(formData.get("patient_id") || "");
  const especialidad = String(formData.get("especialidad") || "");
  const cantidad = Number(formData.get("cantidad") || 0);
  const unidad = String(formData.get("unidad") || "semana");
  const dias = formData.getAll("dias").map(Number).filter((d) => d >= 1 && d <= 7);
  const nota = String(formData.get("nota") || "").trim() || null;
  if (!patient_id || !ESPECIALIDADES.has(especialidad)) throw new Error("Faltan el paciente o la disciplina.");
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) throw new Error("La cantidad tiene que ser un número entre 1 y 50.");
  if (unidad !== "dia" && unidad !== "semana") throw new Error("La unidad tiene que ser día o semana.");

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: previo } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patient_id)
    .eq("especialidad", especialidad as Enums<"specialty">)
    .eq("activo", true)
    .maybeSingle();
  if (previo) {
    const { error: e1 } = await supabase.from("treatment_plans").update({ activo: false, hasta: hoy }).eq("id", previo.id);
    if (e1) throw new Error(e1.message);
  }
  const { error } = await supabase.from("treatment_plans").insert({
    patient_id,
    especialidad: especialidad as Enums<"specialty">,
    cantidad,
    unidad,
    dias_semana: dias.length > 0 ? dias : null,
    desde: hoy,
    reemplaza_id: previo?.id ?? null,
    nota,
    creado_por: profile.id,
  });
  if (error) throw new Error(error.message);
  refresh(patient_id);
  await flash(previo ? "Plan actualizado. El anterior queda en el historial." : "Plan de tratamiento guardado. Coordinación ya ve cuántas visitas faltan programar.");
}

export async function endPlanAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!PLAN_ROLES.includes(profile.role)) throw new Error("Solo Administración o Coordinación modifican el plan de tratamiento.");
  const supabase = await createClient();
  const plan_id = String(formData.get("plan_id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  const { error } = await supabase.from("treatment_plans").update({ activo: false, hasta: new Date().toISOString().slice(0, 10) }).eq("id", plan_id);
  if (error) throw new Error(error.message);
  refresh(patient_id);
  await flash("Disciplina quitada del plan. Queda en el historial.");
}

// Mensajes internos por paciente (G2): reemplazan al WhatsApp personal para datos del caso.
export async function postMessageAction(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const mensaje = String(formData.get("mensaje") || "").trim();
  if (!patient_id || !mensaje) return;
  if (mensaje.length > 1000) throw new Error("El mensaje es demasiado largo (máximo 1000 caracteres).");
  const { error } = await supabase.from("patient_messages").insert({ patient_id, mensaje });
  if (error) throw new Error("No se pudo enviar el mensaje: solo el equipo del paciente puede escribir acá.");
  revalidatePath(`/paciente/${patient_id}`);
  await flash("Mensaje enviado al equipo del paciente.");
}

// Paso 4 del alta: medicación vigente.
export async function addMedicationAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!PLAN_ROLES.includes(profile.role)) throw new Error("Solo Administración o Coordinación cargan la medicación vigente.");
  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const medicamento = String(formData.get("medicamento") || "").trim();
  if (!patient_id || !medicamento) throw new Error("Falta el nombre del medicamento.");
  const clean = (k: string) => String(formData.get(k) || "").trim() || null;
  const { error } = await supabase.from("patient_medications").insert({ patient_id, medicamento, dosis: clean("dosis"), via: clean("via"), frecuencia: clean("frecuencia") });
  if (error) throw new Error(error.message);
  refresh(patient_id);
  await flash("Medicación agregada.");
}

export async function removeMedicationAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!PLAN_ROLES.includes(profile.role)) throw new Error("Solo Administración o Coordinación modifican la medicación vigente.");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  const { error } = await supabase.from("patient_medications").update({ activo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(patient_id);
  await flash("Medicamento quitado de la lista vigente.");
}

// "Sin medicación vigente": cierra el paso 4 aunque la lista esté vacía.
export async function confirmNoMedicationAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración confirma el paso de medicación.");
  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const { error } = await supabase.from("patients").update({ medicacion_confirmada_at: new Date().toISOString() }).eq("id", patient_id);
  if (error) throw new Error(error.message);
  refresh(patient_id);
  await flash("Paso de medicación completo.");
}

// Paso 5: checklist "Información al Paciente" (R PFS 01, 11 ítems).
export async function toggleChecklistItemAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración completa el checklist de información al paciente.");
  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const item_id = String(formData.get("item_id") || "");
  const marcado = String(formData.get("marcado") || "") === "1";
  if (marcado) {
    const { error } = await supabase.from("patient_info_checklist").delete().eq("patient_id", patient_id).eq("item_id", item_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("patient_info_checklist").insert({ patient_id, item_id });
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  refresh(patient_id);
}

// Paso 6: documentación requerida por la obra social.
export async function toggleRequiredDocAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración registra la documentación recibida.");
  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const doc_id = String(formData.get("doc_id") || "");
  const marcado = String(formData.get("marcado") || "") === "1";
  if (marcado) {
    const { error } = await supabase.from("patient_required_documents").delete().eq("patient_id", patient_id).eq("doc_id", doc_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("patient_required_documents").insert({ patient_id, doc_id });
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  refresh(patient_id);
}
