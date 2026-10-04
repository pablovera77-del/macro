"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { redirect } from "next/navigation";
import type { Enums, TablesUpdate } from "@/types/database";

// DF-C2 §4: Coordinación programa la visita.
export async function createVisitAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion"];
  if (!allowed.includes(profile.role)) throw new Error("Solo Coordinación programa visitas.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const profesional_id = String(formData.get("profesional_id") || "");
  const especialidad = String(formData.get("especialidad") || "") as Enums<"specialty">;
  const fecha_programada = String(formData.get("fecha_programada") || "");
  const observacion_agenda = String(formData.get("observacion_agenda") || "").trim() || null;

  if (!patient_id || !profesional_id || !especialidad || !fecha_programada) throw new Error("Faltan datos de la visita.");

  const { error } = await supabase.from("visits").insert({
    patient_id,
    profesional_id,
    especialidad,
    fecha_programada: new Date(fecha_programada).toISOString(),
    observacion_agenda,
    creado_por: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
  await flash("Visita programada. El profesional la ve en «Mi agenda».");
  return;
}

// El profesional confirma o marca el resultado de su propia visita (DF-C2 §4).
export async function updateVisitStatusAction(formData: FormData) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  const estado = String(formData.get("estado") || "") as Enums<"visit_status">;
  if (!visit_id || !estado) throw new Error("Faltan datos.");

  const patch: TablesUpdate<"visits"> = { estado };
  if (estado === "realizada") patch.fecha_realizada = new Date().toISOString();

  const { error } = await supabase.from("visits").update(patch).eq("id", visit_id);
  if (error) throw new Error(error.message);

  void profile;
  revalidatePath("/agenda");
  revalidatePath("/evoluciones");
  revalidatePath("/inicio");
  // Cierre de visita: al marcarla realizada se lleva al profesional directo a
  // cargar su evolución (antes tenía que ir a buscarla a otra pantalla).
  if (estado === "realizada") redirect(`/evoluciones?visita=${visit_id}`);
  if (estado === "no_realizada") await flash("Visita marcada como no realizada. Coordinación la va a ver para reprogramarla.");
  return;
}

// E4: Coordinación reprograma una visita atrasada sin tener que cancelarla y volver a crearla.
export async function rescheduleVisitAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion"];
  if (!allowed.includes(profile.role)) throw new Error("Solo Coordinación reprograma visitas.");
  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  const fecha = String(formData.get("fecha_programada") || "");
  if (!visit_id || !fecha) throw new Error("Falta la nueva fecha.");
  const nueva = new Date(fecha);
  if (Number.isNaN(nueva.getTime())) throw new Error("La fecha no es válida.");
  const { error } = await supabase.from("visits").update({ fecha_programada: nueva.toISOString(), estado: "programada" }).eq("id", visit_id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  await flash("Visita reprogramada. El profesional la ve con la nueva fecha en «Mi agenda».");
  return;
}

export async function cancelVisitAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion"];
  if (!allowed.includes(profile.role)) throw new Error("Solo Coordinación cancela visitas.");

  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  const { error } = await supabase.from("visits").update({ estado: "cancelada" }).eq("id", visit_id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
  await flash("Visita cancelada.");
  return;
}
