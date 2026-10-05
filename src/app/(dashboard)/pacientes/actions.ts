"use server";

import { ymdAR } from "@/lib/plan";
import { MOTIVOS_EGRESO_OPCIONES, motivoParaFormulario, parseDatetimeLocalAR } from "@/lib/egreso";
import { fechaCorta } from "@/lib/paciente";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { avisar } from "@/lib/order-notices";
import type { Enums } from "@/types/database";

// El alta de pacientes se hace desde Internación (createAdmissionAction,
// DF-C3), con el legajo completo — no desde acá. Antes existía un
// createPatientAction paralelo con 4 campos que podía generar un
// registro duplicado/incompleto frente al que arma Internación sobre la
// misma tabla `patients`; se sacó para que haya un único punto de alta.

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

  // R03: la carga avisa a Depósito (queda en su panel de avisos de Pedidos).
  const [{ data: pac }, { data: prod }] = await Promise.all([
    supabase.from("patients").select("nombre_completo").eq("id", patient_id).maybeSingle(),
    supabase.from("products").select("descripcion").eq("id", product_id).maybeSingle(),
  ]);
  await avisar(supabase, profile.id, {
    rol: "deposito",
    tipo: "autorizacion_nueva",
    titulo: `Nueva autorización de stock: ${pac?.nombre_completo ?? "paciente"}`,
    detalle: `${cantidad_autorizada}x ${prod?.descripcion ?? "producto"}${vigente_hasta ? ` (hasta ${vigente_hasta})` : ""}. Ya podés armar el pedido.`,
    href: "/pedidos",
    patient_id,
  });

  revalidatePath("/pacientes");
  await flash("Autorización de stock cargada. Depósito ya puede armar el pedido.");
  return;
}

// DF-C3 §11 y §11.1, PASO 2 del flujo de egreso revisado: Administración confirma la
// baja definitiva que un profesional/coordinación ya informó (reportarEgresoAction,
// internacion/actions.ts) o cierra la internación directamente. Se hace desde el panel de
// cierre guiado (motivo y fecha del hecho, equipos a retirar, confirmación). Acá recién se
// cierra el paciente y se dispara la alerta a Depósito (discharge_alerts + checklist de
// retiro, vínculo con C5). El episodio de internación y la línea de tiempo los registra la
// base con un trigger sobre `patients` (quién informó, quién confirmó y cuándo).
export type CierreState = { error: string | null };

export async function confirmarEgresoAction(_prev: CierreState, formData: FormData): Promise<CierreState> {
  const { profile } = await requireProfile();
  // Los errores de negocio se devuelven (no se lanzan) para que el panel los muestre en castellano.
  if (profile.role !== "administracion") return { error: "Solo Administración confirma la baja definitiva de un paciente." };

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  if (!patient_id) return { error: "Falta el paciente." };

  const { data: patient } = await supabase
    .from("patients")
    .select("nombre_completo, estado, fecha_ingreso, egreso_motivo_informado, egreso_hecho_at")
    .eq("id", patient_id)
    .maybeSingle();
  if (!patient) return { error: "No encontramos al paciente." };
  if (patient.estado === "dado_de_baja") return { error: "Este paciente ya está dado de baja." };

  const motivo = (String(formData.get("motivo") || "") || motivoParaFormulario(patient.egreso_motivo_informado) || "") as Enums<"discharge_reason">;
  if (!motivo) return { error: "Elegí el motivo del egreso." };
  const motivosValidos: string[] = [...MOTIVOS_EGRESO_OPCIONES, "fin_internacion"];
  if (!motivosValidos.includes(motivo)) return { error: "El motivo del egreso no es válido: elegí uno de la lista." };

  // Fecha y hora del hecho: la que se informó, o la que edite Administración (por defecto, ahora).
  const ahora = new Date();
  const hechoForm = String(formData.get("hecho_at") || "");
  const hecho = hechoForm ? parseDatetimeLocalAR(hechoForm) : patient.egreso_hecho_at ?? ahora.toISOString();
  if (!hecho) return { error: "La fecha y hora del egreso no es válida. Revisala." };
  if (new Date(hecho).getTime() > ahora.getTime() + 5 * 60_000) return { error: "La fecha y hora del egreso no puede ser futura." };
  const fecha_egreso = ymdAR(hecho);
  if (patient.fecha_ingreso && fecha_egreso < patient.fecha_ingreso) {
    return { error: `La fecha del egreso (${fechaCorta(fecha_egreso)}) no puede ser anterior a la del ingreso (${fechaCorta(patient.fecha_ingreso)}).` };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ estado: "dado_de_baja", motivo_egreso: motivo, fecha_egreso, egreso_hecho_at: hecho })
    .eq("id", patient_id);
  if (patientError) return { error: `No se pudo registrar la baja: ${patientError.message}` };

  const { data: alert, error } = await supabase
    .from("discharge_alerts")
    .insert({ patient_id, motivo, generado_por: profile.id })
    .select("id")
    .single();
  if (error || !alert) {
    revalidatePath("/pacientes");
    revalidatePath("/internacion");
    return { error: "La baja quedó registrada, pero no se pudo avisar a Depósito para retirar los equipos. Generá el egreso desde Seguimiento." };
  }

  const { data: assignedAssets } = await supabase
    .from("v_equipos_en_domicilio")
    .select("asset_id")
    .eq("patient_id", patient_id);

  const aRetirar = (assignedAssets ?? []).filter((a) => a.asset_id);
  if (aRetirar.length > 0) {
    await supabase.from("retrieval_checklist").insert(
      aRetirar.map((a) => ({ discharge_alert_id: alert.id, asset_id: a.asset_id as string }))
    );
  }

  revalidatePath("/pacientes");
  revalidatePath("/internacion");
  revalidatePath("/seguimiento");
  revalidatePath(`/paciente/${patient_id}`);
  await flash(
    `Baja confirmada: ${patient.nombre_completo}, ${fechaCorta(fecha_egreso)}. ` +
      (aRetirar.length > 0
        ? `Depósito y Transporte recibieron la alerta para retirar ${aRetirar.length === 1 ? "1 equipo" : `${aRetirar.length} equipos`} del domicilio.`
        : "No había equipos en el domicilio para retirar.")
  );
  return { error: null };
}
