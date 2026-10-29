"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";

// Estudios complementarios del paciente (Vanina, 26/10): laboratorio, radiografías, biopsias, etc., con archivo adjunto.
// Los carga Administración; el médico los solicita y Administración los gestiona (presupuesto, autorización o turno).
export type EstudioState = { error: string | null; ok?: boolean };

const TIPOS_ARCHIVO: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 10 * 1024 * 1024;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function refrescar(patientId: string) {
  revalidatePath(`/paciente/${patientId}`);
}

export async function agregarEstudioAction(_prev: EstudioState, formData: FormData): Promise<EstudioState> {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") return { error: "Solo Administración carga los estudios complementarios." };
  const patient_id = String(formData.get("patient_id") || "");
  const descripcion = String(formData.get("descripcion") || "").trim();
  const fecha = String(formData.get("fecha_estudio") || "");
  const se_factura = formData.get("se_factura") === "on";
  const autorizado = se_factura ? String(formData.get("autorizado") || "") === "si" : null;
  const solicitud_id = String(formData.get("solicitud_id") || "") || null;
  const archivo = formData.get("archivo");
  if (!patient_id) return { error: "Falta el paciente." };
  if (!descripcion) return { error: "Escribí de qué estudio se trata (ej. «Laboratorio de rutina», «Radiografía de tórax»)." };
  if (fecha && !FECHA.test(fecha)) return { error: "La fecha del estudio no es válida." };

  const supabase = await createClient();
  let ruta: string | null = null;
  let nombre_original: string | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    const ext = TIPOS_ARCHIVO[archivo.type];
    if (!ext) return { error: "El archivo tiene que ser un PDF o una imagen (JPG, PNG)." };
    if (archivo.size > MAX_BYTES) return { error: "El archivo pesa más de 10 MB. Comprimilo o sacale una foto con menos calidad." };
    ruta = `${patient_id}/${crypto.randomUUID()}.${ext}`;
    const { error: eUp } = await supabase.storage.from("estudios").upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, upsert: false });
    if (eUp) return { error: `No se pudo subir el archivo (${eUp.message}). Probá de nuevo.` };
    nombre_original = archivo.name.slice(0, 200);
  }
  const { error } = await supabase.from("patient_studies").insert({
    patient_id,
    descripcion,
    fecha_estudio: fecha || null,
    se_factura,
    autorizado,
    archivo: ruta,
    nombre_original,
    solicitud_id,
    cargado_por: profile.id,
  });
  if (error) {
    if (ruta) await supabase.storage.from("estudios").remove([ruta]);
    return { error: "No se pudo guardar el estudio. Probá de nuevo." };
  }
  if (solicitud_id) {
    await supabase.from("study_requests").update({ estado: "gestionado", gestionado_por: profile.id, gestionado_at: new Date().toISOString() }).eq("id", solicitud_id).eq("estado", "pendiente");
  }
  refrescar(patient_id);
  await flash("Estudio agregado al paciente.");
  return { error: null, ok: true };
}

export async function actualizarEstudioFacturacionAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración modifica los estudios complementarios.");
  const id = String(formData.get("id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  const autorizado = String(formData.get("autorizado") || "") === "si";
  if (!id) throw new Error("Falta el estudio.");
  const supabase = await createClient();
  const { error } = await supabase.from("patient_studies").update({ autorizado }).eq("id", id).eq("se_factura", true);
  if (error) throw new Error(error.message);
  refrescar(patient_id);
  await flash(autorizado ? "Estudio marcado como autorizado." : "Estudio marcado como pendiente de autorización.");
}

export async function eliminarEstudioAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración modifica los estudios complementarios.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Falta el estudio.");
  const supabase = await createClient();
  const { data: est } = await supabase.from("patient_studies").select("archivo, patient_id").eq("id", id).maybeSingle();
  if (!est) throw new Error("No encontramos el estudio.");
  const { error } = await supabase.from("patient_studies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (est.archivo) await supabase.storage.from("estudios").remove([est.archivo]);
  refrescar(est.patient_id);
  await flash("Estudio quitado del paciente.");
}

// El médico pide un estudio: queda registrado y se avisa a Administración (la base valida que sea médico y que el paciente esté en su equipo).
export async function solicitarEstudioAction(_prev: EstudioState, formData: FormData): Promise<EstudioState> {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") return { error: "Solo un profesional asistencial médico solicita estudios." };
  const patient_id = String(formData.get("patient_id") || "");
  const detalle = String(formData.get("detalle") || "").trim();
  if (!patient_id) return { error: "Falta el paciente." };
  if (!detalle) return { error: "Escribí qué estudio necesitás." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_solicitar_estudio", { p_patient: patient_id, p_detalle: detalle });
  if (error) return { error: error.message };
  refrescar(patient_id);
  await flash("Pedido enviado a Administración.");
  return { error: null, ok: true };
}

export async function gestionarSolicitudEstudioAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración gestiona las solicitudes de estudios.");
  const id = String(formData.get("id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  const estado = String(formData.get("estado") || "") === "cancelado" ? "cancelado" : "gestionado";
  if (!id) throw new Error("Falta la solicitud.");
  const supabase = await createClient();
  const { error } = await supabase.from("study_requests").update({ estado, gestionado_por: profile.id, gestionado_at: new Date().toISOString() }).eq("id", id).eq("estado", "pendiente");
  if (error) throw new Error(error.message);
  refrescar(patient_id);
  await flash(estado === "gestionado" ? "Solicitud marcada como gestionada." : "Solicitud cancelada.");
}
