"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

// DF-C2 §5: registro de evolución clínica, motor de formulario dinámico
// por disciplina (operacionaliza el activo del sistema viejo — informe-
// tecnico §3.2 — con las definiciones clínicas reales de DF-C2).
// DF-C2 §5.4: si la disciplina es enfermería y se cargan los 5 puntajes de
// la Escala Nova 5, calculamos el riesgo de UPP automáticamente.
export async function createEvolutionAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["profesional_asistencial", "medico_coordinador"];
  if (!allowed.includes(profile.role)) throw new Error("Solo el profesional asistencial carga evoluciones.");

  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "") || null;
  const patient_id = String(formData.get("patient_id") || "");
  const especialidad = String(formData.get("especialidad") || "") as Enums<"specialty">;
  const template_id = String(formData.get("template_id") || "") || null;
  const firmar = formData.get("firmar") === "on";
  const conformidad_familiar = formData.get("conformidad_familiar") === "on";

  if (!patient_id || !especialidad) throw new Error("Faltan datos de la evolución.");

  // Campos dinámicos: cualquier input cuyo name empiece con "campo__"
  const respuestas: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("campo__") && typeof value === "string" && value.trim() !== "") {
      respuestas[key.replace("campo__", "")] = value;
    }
  }

  let upp_escala_nova5: Record<string, number | string> | null = null;
  const nova5Keys = ["estado_mental", "incontinencia", "movilidad", "nutricion", "actividad"];
  if (nova5Keys.every((k) => formData.get(`nova5__${k}`))) {
    const scores = nova5Keys.map((k) => Number(formData.get(`nova5__${k}`) || 0));
    const total = scores.reduce((a, b) => a + b, 0);
    const riesgo = total <= 4 ? "bajo" : total <= 8 ? "medio" : "alto";
    upp_escala_nova5 = {
      estado_mental: scores[0],
      incontinencia: scores[1],
      movilidad: scores[2],
      nutricion: scores[3],
      actividad: scores[4],
      total,
      riesgo,
    };
  }

  const { error } = await supabase.from("evolutions").insert({
    visit_id,
    patient_id,
    profesional_id: profile.id,
    especialidad,
    template_id,
    respuestas,
    upp_escala_nova5,
    firma_profesional_at: firmar ? new Date().toISOString() : null,
    conformidad_familiar,
    conformidad_familiar_at: conformidad_familiar ? new Date().toISOString() : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/evoluciones");
  revalidatePath("/agenda");
  return;
}
