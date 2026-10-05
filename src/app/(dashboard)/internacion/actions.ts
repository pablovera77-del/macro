"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, ROLES_ALTA } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { redirect } from "next/navigation";
import type { Enums } from "@/types/database";
import { DISCIPLINAS_PLAN, hoyAR } from "@/lib/plan";
import { ESTADO_PACIENTE_LABELS } from "@/lib/paciente";
import { MOTIVOS_EGRESO_OPCIONES, motivoEgresoLabel, parseDatetimeLocalAR } from "@/lib/egreso";
import type { AppRole } from "@/lib/auth";

// DF-C3 §2 y §3: el alta, el legajo, las firmas de ingreso y las autorizaciones
// los gestiona Administración. Coordinación confirma la llegada al domicilio
// para coordinar la primera visita. El rol "Médico coordinador" se retiró.
const LLEGADA_ROLES: AppRole[] = ["administracion", "coordinador_internacion"];
const EQUIPO_ROLES: AppRole[] = ["administracion", "coordinador_internacion"];

const ESTADO_LABEL: Record<string, string> = ESTADO_PACIENTE_LABELS;

// Wizard de admisión — legajo completo (DF-C3 §3/§4). Mejora sobre el
// sistema viejo, que solo pedía nombre/domicilio/obra social en texto libre
// (informe-tecnico §4): acá la obra social es una FK real a obras_sociales.
export type AdmissionState = { error: string | null };

type Legajo = {
  nombre_completo: string;
  dni: string;
  fecha_nacimiento: string;
  sexo: string;
  ocupacion: string | null;
  localidad: string;
  domicilio: string;
  telefono_contacto: string | null;
  domicilio_actual: string | null;
  telefono_actual: string | null;
  lat: number | null;
  lng: number | null;
  contacto_familiar_nombre: string;
  contacto_familiar_telefono: string;
  diagnostico_principal: string;
  obra_social_id: string | null;
  numero_afiliado: string | null;
  medico_derivante: string | null;
  medico_matricula: string | null;
  fecha_ingreso: string;
};

const txt = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
const num = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Lee y valida los datos del paso 1 a 3 del alta (DF-C3 §4.1 y §4.2). Devuelve el error en castellano si falta algo.
function leerLegajo(fd: FormData): { error: string } | { datos: Legajo } {
  const nombre_completo = txt(fd, "nombre_completo");
  // El DNI es el identificador único del paciente en toda la plataforma
  // (pedido de Pablo, 25/09) — se normaliza a solo dígitos acá para que
  // "30.998.221" y "30998221" cuenten como el mismo DNI.
  const dni = String(fd.get("dni") || "").replace(/\D/g, "");
  const fecha_nacimiento = txt(fd, "fecha_nacimiento");
  const sexo = txt(fd, "sexo");
  const localidad = txt(fd, "localidad");
  const domicilio = txt(fd, "domicilio");
  const contacto_familiar_nombre = txt(fd, "contacto_familiar_nombre");
  const contacto_familiar_telefono = txt(fd, "contacto_familiar_telefono");
  const diagnostico_principal = txt(fd, "diagnostico_principal");
  const obra_social_id = txt(fd, "obra_social_id") || null;
  const numero_afiliado = txt(fd, "numero_afiliado") || null;
  const fecha_ingreso = txt(fd, "fecha_ingreso") || hoyAR();
  const lat = num(fd, "lat");
  const lng = num(fd, "lng");

  if (!dni) return { error: "Falta el DNI: es obligatorio y es el identificador único del paciente en todo el sistema." };
  if (dni.length < 6 || dni.length > 9) return { error: "El DNI no parece válido (debe tener entre 6 y 9 dígitos)." };
  if (!nombre_completo) return { error: "Falta el nombre y apellido del paciente." };
  if (!fecha_nacimiento) return { error: "Falta la fecha de nacimiento del paciente." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento) || fecha_nacimiento > hoyAR()) return { error: "La fecha de nacimiento no es válida: no puede ser posterior a hoy." };
  if (!["femenino", "masculino", "otro"].includes(sexo)) return { error: "Elegí el sexo del paciente." };
  if (!localidad) return { error: "Falta la localidad del domicilio del paciente." };
  if (!domicilio) return { error: "Falta el domicilio del paciente: es donde se agendan las visitas." };
  if (!contacto_familiar_nombre) return { error: "Falta el nombre de la persona responsable (familiar o referente)." };
  if (contacto_familiar_telefono.replace(/\D/g, "").length < 8) return { error: "Falta el teléfono de la persona responsable, o no parece válido (con código de área, mínimo 8 números): se usa para avisarle por WhatsApp." };
  if (obra_social_id && !numero_afiliado) return { error: "Falta el N° de afiliado: es obligatorio cuando el paciente tiene obra social." };
  if (!diagnostico_principal) return { error: "Falta el diagnóstico principal (motivo de la internación domiciliaria)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_ingreso)) return { error: "La fecha de ingreso no es válida." };
  if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) return { error: "La ubicación capturada no es válida: volvé a capturarla o dejala vacía." };

  return {
    datos: {
      nombre_completo,
      dni,
      fecha_nacimiento,
      sexo,
      ocupacion: txt(fd, "ocupacion") || null,
      localidad,
      domicilio,
      telefono_contacto: txt(fd, "telefono_contacto") || null,
      domicilio_actual: txt(fd, "domicilio_actual") || null,
      telefono_actual: txt(fd, "telefono_actual") || null,
      lat,
      lng,
      contacto_familiar_nombre,
      contacto_familiar_telefono,
      diagnostico_principal,
      obra_social_id,
      numero_afiliado,
      medico_derivante: txt(fd, "medico_derivante") || null,
      medico_matricula: txt(fd, "medico_matricula") || null,
      fecha_ingreso,
    },
  };
}

export async function createAdmissionAction(_prev: AdmissionState, formData: FormData): Promise<AdmissionState> {
  const { profile } = await requireProfile();
  // Los errores de negocio se DEVUELVEN (no se lanzan): en producción Next.js
  // oculta el texto de los errores lanzados desde una server action y el
  // usuario veía una pantalla genérica en vez de "ya existe ese DNI".
  if (!ROLES_ALTA.includes(profile.role)) {
    return { error: "Solo Administración da de alta pacientes." };
  }

  const supabase = await createClient();
  const leido = leerLegajo(formData);
  if ("error" in leido) return { error: leido.error };
  const d = leido.datos;
  const reingresoId = txt(formData, "reingreso_patient_id") || null;

  // Denormalizamos también el nombre de la obra social en la columna de texto
  // existente (obra_social) para no romper la UI del mockup C5 (Catálogo/Pedidos)
  // que todavía la lee como texto plano.
  let obra_social_texto: string | null = null;
  if (d.obra_social_id) {
    const { data: os } = await supabase.from("obras_sociales").select("nombre").eq("id", d.obra_social_id).single();
    obra_social_texto = os?.nombre ?? null;
  }

  let patientId: string;
  let esReingreso = false;
  if (reingresoId) {
    // Nueva internación de un paciente que ya tiene legajo (DF-C3 §3.1): se reabre el mismo legajo.
    // El episodio nuevo y la línea de tiempo los registra la base (trigger sobre patients).
    const { data: previo } = await supabase.from("patients").select("id, dni, estado, nro_historia_clinica").eq("id", reingresoId).maybeSingle();
    if (!previo) return { error: "No encontramos el legajo del paciente. Volvé al paso 1 y buscalo de nuevo por DNI." };
    if (previo.dni !== d.dni) return { error: "El DNI no coincide con el del legajo que se está reabriendo. Volvé al paso 1." };
    if (previo.estado !== "dado_de_baja") return { error: "Este paciente ya tiene una internación en curso: abrí su legajo desde la lista de pacientes." };
    const { error: upErr } = await supabase
      .from("patients")
      .update({
        ...d,
        obra_social: obra_social_texto,
        estado: "admitido_pendiente_llegada",
        fecha_egreso: null,
        motivo_egreso: null,
        egreso_hecho_at: null,
        llegada_confirmada_at: null,
        egreso_informado_at: null,
        egreso_informado_por: null,
        egreso_motivo_informado: null,
        medicacion_confirmada_at: null,
      })
      .eq("id", reingresoId);
    if (upErr) return { error: upErr.message };
    // El plan anterior queda archivado en el historial; el de esta internación se carga en el paso 3.
    await supabase.from("treatment_plans").update({ activo: false, hasta: hoyAR() }).eq("patient_id", reingresoId).eq("activo", true);
    patientId = reingresoId;
    esReingreso = true;
  } else {
    const { data: creado, error } = await supabase
      .from("patients")
      .insert({
        ...d,
        obra_social: obra_social_texto,
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
        const { data: existente } = await supabase.from("patients").select("nombre_completo, estado, nro_historia_clinica").eq("dni", d.dni).maybeSingle();
        return {
          error: existente
            ? `Ya existe un paciente con DNI ${d.dni}: ${existente.nombre_completo} (historia clínica N° ${existente.nro_historia_clinica ?? "—"}, ${ESTADO_LABEL[existente.estado] ?? existente.estado}). Volvé al paso 1 con ese DNI: ahí podés abrir su legajo o, si está dado de baja, iniciar una nueva internación.`
            : `Ya existe un paciente con DNI ${d.dni}. Volvé al paso 1 con ese DNI para abrir su legajo.`,
        };
      }
      return { error: error?.message ?? "No se pudo crear el paciente. Probá de nuevo." };
    }
    patientId = creado.id;
  }

  // Paso 3 del DF-C3 §3: plan de tratamiento por disciplina y equipo asistencial.
  const planRows: { patient_id: string; especialidad: Enums<"specialty">; cantidad: number; unidad: string; dias_semana: number[] | null; creado_por: string }[] = [];
  const teamRows: { patient_id: string; especialidad: Enums<"specialty">; profesional_id: string }[] = [];
  for (const esp of DISCIPLINAS_PLAN) {
    const cantidad = Number(formData.get(`plan__${esp}__cantidad`) || 0);
    if (Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 50) {
      const unidad = String(formData.get(`plan__${esp}__unidad`) || "semana") === "dia" ? "dia" : "semana";
      const dias = formData.getAll(`plan__${esp}__dias`).map(Number).filter((n) => n >= 1 && n <= 7);
      planRows.push({ patient_id: patientId, especialidad: esp, cantidad, unidad, dias_semana: dias.length > 0 ? dias : null, creado_por: profile.id });
    }
    const prof = String(formData.get(`equipo__${esp}`) || "");
    if (prof) teamRows.push({ patient_id: patientId, especialidad: esp, profesional_id: prof });
  }
  let aviso = "";
  if (planRows.length > 0) {
    const { error: e1 } = await supabase.from("treatment_plans").insert(planRows);
    if (e1) aviso += " No se pudo guardar el plan de tratamiento: cargalo desde la ficha.";
  }
  if (teamRows.length > 0) {
    // En una nueva internación puede que el profesional ya esté en el equipo: se ignora el repetido.
    const { error: e2 } = await supabase.from("patient_care_team").upsert(teamRows, { onConflict: "patient_id,profesional_id,especialidad", ignoreDuplicates: true });
    if (e2) aviso += " No se pudo guardar el equipo: asignalo desde Pacientes.";
  }

  revalidatePath("/internacion");
  revalidatePath(`/paciente/${patientId}`);
  await flash(
    esReingreso
      ? `Nueva internación abierta para ${d.nombre_completo}. Quedó en «Admitido, pendiente de llegada»: completá medicación, consentimientos y documentación, y confirmá la llegada.${aviso}`
      : `Paciente admitido (${d.nombre_completo}). Siguiente paso: completar medicación, consentimientos y documentación de la obra social.${aviso}`
  );
  // Al terminar, la ficha abre en el ingreso para completar los pasos 4 a 6.
  redirect(`/paciente/${patientId}?tab=ingreso`);
}

// Paso 1 del wizard: ¿ya existe un paciente con este DNI o uno parecido? Se consulta antes de
// completar el resto del formulario, para evitar duplicados en vez de descubrirlos al final.
// - DNI existente: devuelve el legajo y su historial de internaciones (DF-C3 §3.1) para ofrecer
//   «Abrir legajo» o «Nueva internación para este paciente».
// - DNI nuevo: busca nombres parecidos (sin tildes ni mayúsculas) y teléfonos repetidos y los
//   devuelve como aviso (no bloquea el alta).
export type PacienteLegajo = {
  id: string;
  nombre_completo: string;
  estado: string;
  estado_label: string;
  nro_historia_clinica: number | null;
  datos: Record<string, string | null>;
};
export type InternacionResumen = { numero: number; estado: string; fecha_ingreso: string | null; fecha_egreso: string | null; motivo: string | null };
export type PacienteSimilar = { id: string; nombre_completo: string; dni: string; estado_label: string; nro_historia_clinica: number | null; motivo: string };
export type DniCheck = { valido: boolean; existe: boolean; paciente?: PacienteLegajo; internaciones?: InternacionResumen[]; similares?: PacienteSimilar[] };

export async function checkDniAction(dniRaw: string, nombre?: string, telefono?: string): Promise<DniCheck> {
  const { profile } = await requireProfile();
  if (!ROLES_ALTA.includes(profile.role)) return { existe: false, valido: false };
  const dni = String(dniRaw || "").replace(/\D/g, "");
  if (dni.length < 6 || dni.length > 9) return { existe: false, valido: false };
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("id, nombre_completo, estado, nro_historia_clinica, fecha_nacimiento, sexo, ocupacion, localidad, domicilio, telefono_contacto, domicilio_actual, telefono_actual, contacto_familiar_nombre, contacto_familiar_telefono, obra_social_id, numero_afiliado, medico_derivante, medico_matricula, diagnostico_principal")
    .eq("dni", dni)
    .maybeSingle();
  if (data) {
    const { data: ints } = await supabase
      .from("patient_internaciones")
      .select("numero, estado, fecha_ingreso, fecha_egreso, motivo_egreso")
      .eq("patient_id", data.id)
      .order("numero", { ascending: false });
    const { id, nombre_completo, estado, nro_historia_clinica, ...datos } = data;
    return {
      existe: true,
      valido: true,
      paciente: { id, nombre_completo, estado, estado_label: ESTADO_LABEL[estado] ?? estado, nro_historia_clinica, datos: datos as Record<string, string | null> },
      internaciones: (ints ?? []).map((i) => ({ numero: i.numero, estado: i.estado, fecha_ingreso: i.fecha_ingreso, fecha_egreso: i.fecha_egreso, motivo: i.motivo_egreso ? motivoEgresoLabel(i.motivo_egreso) : null })),
    };
  }
  const nom = String(nombre || "").trim();
  const tel = String(telefono || "").trim();
  if (nom.length < 3 && tel.length < 8) return { existe: false, valido: true };
  const { data: sim } = await supabase.rpc("fn_buscar_pacientes_similares", { p_nombre: nom, p_telefono: tel, p_dni: dni });
  return {
    existe: false,
    valido: true,
    similares: (sim ?? []).map((s) => ({
      id: s.id,
      nombre_completo: s.nombre_completo,
      dni: s.dni,
      estado_label: ESTADO_LABEL[s.estado] ?? s.estado,
      nro_historia_clinica: s.nro_historia_clinica,
      motivo: s.motivo,
    })),
  };
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
  if (!(MOTIVOS_EGRESO_OPCIONES as readonly string[]).includes(motivo)) throw new Error("El motivo del egreso no es válido: elegí uno de la lista.");

  // Fecha y hora en que ocurrió el hecho (DF-C3 §11). Si falta o es futura, se toma el momento actual.
  const ahora = new Date();
  let hecho = parseDatetimeLocalAR(String(formData.get("hecho_at") || ""));
  if (!hecho || new Date(hecho) > ahora) hecho = ahora.toISOString();

  const { error } = await supabase
    .from("patients")
    .update({
      egreso_informado_at: ahora.toISOString(),
      egreso_informado_por: profile.id,
      egreso_motivo_informado: motivo,
      egreso_hecho_at: hecho,
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
