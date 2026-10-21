"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flash } from "@/lib/flash";

// «Mis pacientes» (acordado con Vanina el 20/10): el profesional ve los pacientes que le asignó Administración o
// Coordinación y, desde ahí, arranca la atención del día. Se crea (o se reutiliza) la visita de hoy, sin día ni hora,
// y sigue el circuito de siempre desde «Mi agenda»: iniciar, realizada, evolución con firma y conformidad de la familia.
export async function atenderPacienteAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") throw new Error("Solo el profesional asistencial atiende desde «Mis pacientes».");
  const patient_id = String(formData.get("patient_id") || "");
  if (!patient_id) throw new Error("Falta indicar el paciente.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_atender_paciente", { p_patient: patient_id });
  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/mis-pacientes");
  await flash("Listo: la atención de hoy quedó en «Mi agenda». Tocá «Iniciar visita» al llegar al domicilio.");
  redirect("/agenda");
}
