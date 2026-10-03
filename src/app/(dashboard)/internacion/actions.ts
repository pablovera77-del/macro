"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

const COORDINACION_ROLES: Enums<"app_role">[] = ["coordinador_internacion", "medico_coordinador"];

const ESTADO_LABEL: Record<string, string> = {
  admitido_pendiente_llegada: "admitido, pendiente de llegada",
  activo: "activo",
  dado_de_baja: "dado de baja",
};

// Wizard de admisión — legajo completo (DF-C3 §3/§4). Mejora sobre el
// sistema viejo, que solo pedía nombre/domicilio/obra social en texto libre
// (informe-tecnico §4): acá la obra social es una FK real a obras_sociales.
export async function createAdmissionAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COORDINACION_ROLES.includes(profile.role)) throw new Error("Solo Coordinación de Internación o Médico Coordinador dan de alta pacientes.");

  const supabase = await createClient();

  const nombre_completo = String(formData.get("nombre_completo") || "").trim();
  // El DNI es el identificador único del paciente en toda la plataforma
  // (pedido de Pablo, 25/09) — se normaliza a solo dígitos acá para que
  // "30.998.221" y "30998221" cuenten como el mismo DNI, igual que ya lo
  // normaliza la migración de base de datos sobre los registros existentes.
  const dni = String(formData.get("dni") || "").replace(/\D/g, "");
  const fecha_nacimiento = String(formData.get("fecha_nacimiento") || "") || null;
  const domicilio = String(formData.get("domicilio") || "").trim();
  const telefono_contacto = String(formData.get("telefono_contacto") || "").trim() || null;
  const contacto_familiar_nombre = String(formData.get("contacto_familiar_nombre") || "").trim() || null;
  const contacto_familiar_telefono = String(formData.get("contacto_familiar_telefono") || "").trim() || null;
  const diagnostico_principal = String(formData.get("diagnostico_principal") || "").trim() || null;
  const obra_social_id = String(formData.get("obra_social_id") || "") || null;
  const numero_afiliado = String(formData.get("numero_afiliado") || "").trim() || null;
  const medico_derivante = String(formData.get("medico_derivante") || "").trim() || null;
  const fecha_ingreso = String(formData.get("fecha_ingreso") || "") || new Date().toISOString().slice(0, 10);

  if (!nombre_completo || !domicilio) throw new Error("Faltan nombre o domicilio.");
  if (!dni) throw new Error("Falta el DNI — es obligatorio y es el identificador único del paciente en todo el sistema.");
  if (dni.length < 6 || dni.length > 9) throw new Error("El DNI no parece válido (debe tener entre 6 y 9 dígitos).");

  // Denormalizamos también el nombre de la obra social en la columna de texto
  // existente (obra_social) para no romper la UI del mockup C5 (Catálogo/Pedidos)
  // que todavía la lee como texto plano.
  let obra_social_texto: string | null = null;
  if (obra_social_id) {
    const { data: os } = await supabase.from("obras_sociales").select("nombre").eq("id", obra_social_id).single();
    obra_social_texto = os?.nombre ?? null;
  }

  const { error } = await supabase.from("patients").insert({
    nombre_completo,
    dni,
    fecha_nacimiento,
    domicilio,
    telefono_contacto,
    contacto_familiar_nombre,
    contacto_familiar_telefono,
    diagnostico_principal,
    obra_social_id,
    obra_social: obra_social_texto,
    numero_afiliado,
    medico_derivante,
    fecha_ingreso,
    coordinador_id: profile.id,
    estado: "admitido_pendiente_llegada",
  });

  if (error) {
    // 23505 = unique_violation — ya existe un paciente con este DNI. Se
    // busca el registro existente para que el mensaje sea accionable (quién
    // es, en vez de un error crudo de Postgres).
    if (error.code === "23505" && error.message.includes("patients_dni_key")) {
      const { data: existente } = await supabase.from("patients").select("nombre_completo, estado").eq("dni", dni).maybeSingle();
      throw new Error(
        existente
          ? `Ya existe un paciente con DNI ${dni}: ${existente.nombre_completo} (${ESTADO_LABEL[existente.estado] ?? existente.estado}). No se puede dar de alta dos veces al mismo paciente — buscalo en la lista.`
          : `Ya existe un paciente con DNI ${dni}. No se puede dar de alta dos veces al mismo paciente.`
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/internacion");
  return;
}

// DF-C3 §12: confirmación de llegada al domicilio — insumo crítico del
// control "no facturar días de más" (DF-C4 §5).
export async function confirmArrivalAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COORDINACION_ROLES.includes(profile.role)) throw new Error("Solo Coordinación confirma la llegada.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  if (!patient_id) throw new Error("Falta el paciente.");

  const { error } = await supabase
    .from("patients")
    .update({ estado: "activo", llegada_confirmada_at: new Date().toISOString() })
    .eq("id", patient_id);

  if (error) throw new Error(error.message);
  revalidatePath("/internacion");
  return;
}

// DF-C3 §11, flujo de egreso revisado (comentario cliente): "Cualquier
// profesional asistencial que esté con el paciente tiene un botón para
// informar... pero no cierra el caso por sí solo". Este es el PASO 1 — solo
// deja constancia de que se informó el egreso y por qué. El cierre
// definitivo (estado, discharge_alerts) lo hace Administración por separado
// con confirmarEgresoAction (pacientes/actions.ts).
const EGRESO_INFORMANTE_ROLES: Enums<"app_role">[] = [...COORDINACION_ROLES, "profesional_asistencial"];

export async function reportarEgresoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!EGRESO_INFORMANTE_ROLES.includes(profile.role)) {
    throw new Error("Solo un profesional asistencial, Coordinación o Médico Coordinador pueden informar un egreso.");
  }

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const motivo = String(formData.get("motivo") || "") as Enums<"discharge_reason">;
  if (!patient_id || !motivo) throw new Error("Faltan paciente o motivo.");

  const { error } = await supabase
    .from("patients")
    .update({
      egreso_informado_at: new Date().toISOString(),
      egreso_informado_por: profile.id,
      egreso_motivo_informado: motivo,
    })
    .eq("id", patient_id);
  if (error) throw new Error(error.message);

  revalidatePath("/internacion");
  revalidatePath("/pacientes");
  return;
}

// DF-C3 §7 / DF-C4 §3: autorización de práctica por obra social — la base
// del semáforo de vencimientos.
export async function addTreatmentAuthorizationAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion", "medico_coordinador", "administracion"];
  if (!allowed.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const practica = String(formData.get("practica") || "").trim();
  const especialidad = String(formData.get("especialidad") || "") as Enums<"specialty">;
  const cantidad_autorizada = Number(formData.get("cantidad_autorizada") || 1);
  const periodo_hasta = String(formData.get("periodo_hasta") || "");

  if (!patient_id || !practica || !especialidad || !periodo_hasta) throw new Error("Faltan datos de la autorización.");

  const { error } = await supabase.from("treatment_authorizations").insert({
    patient_id,
    practica,
    especialidad,
    cantidad_autorizada,
    periodo_hasta,
    autorizado_por: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/internacion");
  return;
}

// DF-C2 §6, resuelto legal hoy (Roy, vía Vanina): no se puede usar una firma
// única para varios documentos — cada consentimiento (legal_documents) se
// firma por separado, con su propio registro de firmante/fecha/geolocalización.
// requiere_firma_profesional (ej. R PFS 04) agrega además la firma del
// profesional actuante en el mismo paso.
export async function signLegalDocumentAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COORDINACION_ROLES.includes(profile.role)) throw new Error("Solo Coordinación de Internación registra las firmas de ingreso.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const legal_document_id = String(formData.get("legal_document_id") || "");
  const firmante_nombre = String(formData.get("firmante_nombre") || "").trim();
  const profesional_id = String(formData.get("profesional_id") || "") || null;
  const lat = formData.get("lat") ? Number(formData.get("lat")) : null;
  const lng = formData.get("lng") ? Number(formData.get("lng")) : null;

  if (!patient_id || !legal_document_id || !firmante_nombre) {
    throw new Error("Faltan datos para registrar la firma (documento, paciente o nombre de quien firma).");
  }

  const { error } = await supabase.from("patient_document_signatures").insert({
    patient_id,
    legal_document_id,
    firmante_nombre,
    geolocalizacion_lat: lat,
    geolocalizacion_lng: lng,
    profesional_id,
    profesional_firmado_at: profesional_id ? new Date().toISOString() : null,
  });

  if (error) {
    // 23505 = unique_violation — ya existe una firma para este par paciente/documento.
    if (error.code === "23505") throw new Error("Este documento ya fue firmado para este paciente.");
    throw new Error(error.message);
  }
  revalidatePath("/internacion");
  return;
}

// Arma el equipo de atención de un paciente (DF-C3 §5).
export async function assignCareTeamAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COORDINACION_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const profesional_id = String(formData.get("profesional_id") || "");
  const especialidad = String(formData.get("especialidad") || "") as Enums<"specialty">;

  if (!patient_id || !profesional_id || !especialidad) throw new Error("Faltan datos del equipo de atención.");

  const { error } = await supabase.from("patient_care_team").insert({ patient_id, profesional_id, especialidad });
  if (error) throw new Error(error.message);
  revalidatePath("/internacion");
  return;
}
