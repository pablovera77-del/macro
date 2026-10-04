"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, ROLES_ALTA } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { redirect } from "next/navigation";
import type { Enums } from "@/types/database";
import { DISCIPLINAS_PLAN } from "@/lib/plan";
import type { AppRole } from "@/lib/auth";

// DF-C3 §2 y §3: el alta, el legajo, las firmas de ingreso y las autorizaciones
// los gestiona Administración. Coordinación confirma la llegada al domicilio
// para coordinar la primera visita. El rol "Médico coordinador" se retiró.
const LLEGADA_ROLES: AppRole[] = ["administracion", "coordinador_internacion"];
const EQUIPO_ROLES: AppRole[] = ["administracion", "coordinador_internacion"];

const ESTADO_LABEL: Record<string, string> = {
  admitido_pendiente_llegada: "admitido, pendiente de llegada",
  activo: "activo",
  dado_de_baja: "dado de baja",
};

// Wizard de admisión — legajo completo (DF-C3 §3/§4). Mejora sobre el
// sistema viejo, que solo pedía nombre/domicilio/obra social en texto libre
// (informe-tecnico §4): acá la obra social es una FK real a obras_sociales.
export type AdmissionState = { error: string | null };

export async function createAdmissionAction(_prev: AdmissionState, formData: FormData): Promise<AdmissionState> {
  const { profile } = await requireProfile();
  // Los errores de negocio se DEVUELVEN (no se lanzan): en producción Next.js
  // oculta el texto de los errores lanzados desde una server action y el
  // usuario veía una pantalla genérica en vez de "ya existe ese DNI".
  if (!ROLES_ALTA.includes(profile.role)) {
    return { error: "Solo Administración da de alta pacientes." };
  }

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

  if (!nombre_completo || !domicilio) return { error: "Faltan el nombre o el domicilio del paciente." };
  if (!dni) return { error: "Falta el DNI: es obligatorio y es el identificador único del paciente en todo el sistema." };
  if (dni.length < 6 || dni.length > 9) return { error: "El DNI no parece válido (debe tener entre 6 y 9 dígitos)." };

  // Denormalizamos también el nombre de la obra social en la columna de texto
  // existente (obra_social) para no romper la UI del mockup C5 (Catálogo/Pedidos)
  // que todavía la lee como texto plano.
  let obra_social_texto: string | null = null;
  if (obra_social_id) {
    const { data: os } = await supabase.from("obras_sociales").select("nombre").eq("id", obra_social_id).single();
    obra_social_texto = os?.nombre ?? null;
  }

  const { data: creado, error } = await supabase
    .from("patients")
    .insert({
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
      // El alta la hace Administración; el médico a cargo se asigna después en el
      // equipo asistencial (no es quien carga el alta).
      coordinador_id: null,
      estado: "admitido_pendiente_llegada",
    })
    .select("id")
    .single();

  if (error || !creado) {
    // 23505 = unique_violation — ya existe un paciente con este DNI. Se
    // busca el registro existente para que el mensaje sea accionable (quién
    // es, en vez de un error crudo de Postgres).
    if (error?.code === "23505" && error.message.includes("patients_dni_key")) {
      const { data: existente } = await supabase.from("patients").select("nombre_completo, estado").eq("dni", dni).maybeSingle();
      return {
        error: existente
          ? `Ya existe un paciente con DNI ${dni}: ${existente.nombre_completo} (${ESTADO_LABEL[existente.estado] ?? existente.estado}). No se puede dar de alta dos veces al mismo paciente: buscalo en la lista.`
          : `Ya existe un paciente con DNI ${dni}. No se puede dar de alta dos veces al mismo paciente.`,
      };
    }
    return { error: error?.message ?? "No se pudo crear el paciente. Probá de nuevo." };
  }

  // Paso 3 del DF-C3 §3: plan de tratamiento por disciplina y equipo asistencial.
  const planRows: { patient_id: string; especialidad: Enums<"specialty">; cantidad: number; unidad: string; dias_semana: number[] | null; creado_por: string }[] = [];
  const teamRows: { patient_id: string; especialidad: Enums<"specialty">; profesional_id: string }[] = [];
  for (const esp of DISCIPLINAS_PLAN) {
    const cantidad = Number(formData.get(`plan__${esp}__cantidad`) || 0);
    if (Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 50) {
      const unidad = String(formData.get(`plan__${esp}__unidad`) || "semana") === "dia" ? "dia" : "semana";
      const dias = formData.getAll(`plan__${esp}__dias`).map(Number).filter((d) => d >= 1 && d <= 7);
      planRows.push({ patient_id: creado.id, especialidad: esp, cantidad, unidad, dias_semana: dias.length > 0 ? dias : null, creado_por: profile.id });
    }
    const prof = String(formData.get(`equipo__${esp}`) || "");
    if (prof) teamRows.push({ patient_id: creado.id, especialidad: esp, profesional_id: prof });
  }
  let aviso = "";
  if (planRows.length > 0) {
    const { error: e1 } = await supabase.from("treatment_plans").insert(planRows);
    if (e1) aviso += " No se pudo guardar el plan de tratamiento: cargalo desde la ficha.";
  }
  if (teamRows.length > 0) {
    const { error: e2 } = await supabase.from("patient_care_team").insert(teamRows);
    if (e2) aviso += " No se pudo guardar el equipo: asignalo desde Pacientes.";
  }

  revalidatePath("/internacion");
  await flash(`Paciente admitido (${nombre_completo}). Siguiente paso: completar medicación, consentimientos y documentación de la obra social.${aviso}`);
  // Al terminar, la ficha abre en el ingreso para completar los pasos 4 a 6.
  redirect(`/paciente/${creado.id}?tab=ingreso`);
}

// Paso 1 del wizard: ¿ya existe un paciente con este DNI? Se consulta antes de
// completar el resto del formulario, para evitar duplicados en vez de
// descubrirlos al final.
export async function checkDniAction(dniRaw: string): Promise<{ existe: boolean; nombre?: string; estado?: string; valido: boolean }> {
  const { profile } = await requireProfile();
  if (!ROLES_ALTA.includes(profile.role)) return { existe: false, valido: false };
  const dni = String(dniRaw || "").replace(/\D/g, "");
  if (dni.length < 6 || dni.length > 9) return { existe: false, valido: false };
  const supabase = await createClient();
  const { data } = await supabase.from("patients").select("nombre_completo, estado").eq("dni", dni).maybeSingle();
  return data
    ? { existe: true, valido: true, nombre: data.nombre_completo, estado: ESTADO_LABEL[data.estado] ?? data.estado }
    : { existe: false, valido: true };
}

// DF-C3 §12: confirmación de llegada al domicilio — insumo crítico del
// control "no facturar días de más" (DF-C4 §5).
export async function confirmArrivalAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!LLEGADA_ROLES.includes(profile.role)) throw new Error("Solo Administración o Coordinación confirman la llegada.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  if (!patient_id) throw new Error("Falta el paciente.");

  const { error } = await supabase
    .from("patients")
    .update({ estado: "activo", llegada_confirmada_at: new Date().toISOString() })
    .eq("id", patient_id);

  if (error) throw new Error(error.message);
  revalidatePath("/internacion");
  await flash("Llegada confirmada. El paciente pasó a «Activo» y Coordinación ya puede programar su primera visita.");
  return;
}

// DF-C3 §11, flujo de egreso revisado (comentario cliente): "Cualquier
// profesional asistencial que esté con el paciente tiene un botón para
// informar... pero no cierra el caso por sí solo". Este es el PASO 1 — solo
// deja constancia de que se informó el egreso y por qué. El cierre
// definitivo (estado, discharge_alerts) lo hace Administración por separado
// con confirmarEgresoAction (pacientes/actions.ts).
const EGRESO_INFORMANTE_ROLES: AppRole[] = ["administracion", "coordinador_internacion", "profesional_asistencial"];

export async function reportarEgresoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!EGRESO_INFORMANTE_ROLES.includes(profile.role)) {
    throw new Error("Solo un profesional asistencial, Coordinación o Administración pueden informar un egreso.");
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
  await flash("Egreso informado. Administración debe confirmar la baja definitiva.");
  return;
}

// DF-C3 §7 / DF-C4 §3: autorización de práctica por obra social — la base
// del semáforo de vencimientos.
export async function addTreatmentAuthorizationAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ROLES_ALTA.includes(profile.role)) throw new Error("Solo Administración carga las autorizaciones de práctica.");

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
  await flash("Práctica autorizada.");
  return;
}

// DF-C2 §6, resuelto legal hoy (Roy, vía Vanina): no se puede usar una firma
// única para varios documentos — cada consentimiento (legal_documents) se
// firma por separado, con su propio registro de firmante/fecha/geolocalización.
// requiere_firma_profesional (ej. R PFS 04) agrega además la firma del
// profesional actuante en el mismo paso.
export async function signLegalDocumentAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ROLES_ALTA.includes(profile.role)) throw new Error("Solo Administración registra las firmas de ingreso.");

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
  revalidatePath(`/paciente/${patient_id}`);
  await flash("Firma registrada.");
  return;
}

// Arma el equipo de atención de un paciente (DF-C3 §5).
export async function assignCareTeamAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!EQUIPO_ROLES.includes(profile.role)) throw new Error("Solo Administración o Coordinación arman el equipo asistencial.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const profesional_id = String(formData.get("profesional_id") || "");
  const especialidad = String(formData.get("especialidad") || "") as Enums<"specialty">;

  if (!patient_id || !profesional_id || !especialidad) throw new Error("Faltan datos del equipo de atención.");

  const { error } = await supabase.from("patient_care_team").insert({ patient_id, profesional_id, especialidad });
  if (error) throw new Error(error.message);
  revalidatePath("/internacion");
  await flash("Profesional asignado al equipo.");
  return;
}
