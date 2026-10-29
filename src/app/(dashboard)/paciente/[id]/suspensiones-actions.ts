"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { hoyAR } from "@/lib/plan";

// Suspensión temporal del servicio (Vanina, 26/10, DF-C3 pregunta 7): en las obras sociales que prorrogan mes a mes
// (Sancor, OSDE, Jerárquicos, OSFATLYF) la internación transitoria se suspende dentro de la misma autorización; en Provincia
// y DAMSU se cierra el ID y se abre uno nuevo. Acá solo se registra el período sin servicio.
export type SuspensionState = { error: string | null; ok?: boolean };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function refrescar(patientId: string) {
  revalidatePath(`/paciente/${patientId}`);
  revalidatePath("/panel-administracion");
}

export async function registrarSuspensionAction(_prev: SuspensionState, formData: FormData): Promise<SuspensionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") return { error: "Solo Administración registra suspensiones del servicio." };
  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const desde = String(formData.get("desde") || "");
  const hasta = String(formData.get("hasta") || "") || null;
  const motivo = String(formData.get("motivo") || "").trim() || null;
  if (!patient_id) return { error: "Falta el paciente." };
  if (!FECHA.test(desde)) return { error: "Indicá desde qué fecha se suspende el servicio." };
  if (hasta && (!FECHA.test(hasta) || hasta < desde)) return { error: "La fecha de reanudación no puede ser anterior a la de suspensión." };

  const { data: abierta } = await supabase.from("service_suspensions").select("id").eq("patient_id", patient_id).is("hasta", null).maybeSingle();
  if (abierta) return { error: "Este paciente ya tiene una suspensión abierta. Registrá primero la reanudación." };

  const { error } = await supabase.from("service_suspensions").insert({ patient_id, desde, hasta, motivo, creado_por: profile.id });
  if (error) return { error: `No se pudo registrar la suspensión: ${error.message}` };
  refrescar(patient_id);
  await flash("Suspensión del servicio registrada.");
  return { error: null, ok: true };
}

export async function reanudarServicioAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración registra la reanudación del servicio.");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  const hasta = String(formData.get("hasta") || "") || hoyAR();
  if (!id) throw new Error("Falta la suspensión a cerrar.");
  if (!FECHA.test(hasta)) throw new Error("La fecha de reanudación no es válida.");
  const { data: s } = await supabase.from("service_suspensions").select("desde").eq("id", id).maybeSingle();
  if (s && hasta < s.desde) throw new Error("La reanudación no puede ser anterior al inicio de la suspensión.");
  const { error } = await supabase.from("service_suspensions").update({ hasta }).eq("id", id);
  if (error) throw new Error(`No se pudo registrar la reanudación: ${error.message}`);
  if (patient_id) refrescar(patient_id);
  await flash("Servicio retomado.");
  return;
}
