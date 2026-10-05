"use server";

import { hoyAR } from "@/lib/plan";
import { formatARS, type ActionResult } from "@/lib/facturacion";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import type { Enums, TablesUpdate } from "@/types/database";

// TODO(DF-C1 §4.3): este gate asume que "administracion" factura — DF-C4 §2
// corrigió a DF-C1, que hablaba de un rol "Facturación" aparte. Pendiente de
// que Vanina confirme si en la práctica Facturación va a ser un rol de
// sistema propio (con su propio usuario) o sigue siendo una tarea más de
// Administración. Si se confirma como rol aparte, agregarlo acá y en
// facturacion/page.tsx (canManage) — y revisar si también debería poder
// cargar débitos sin pasar por Administración.
const BILLING_ROLES: Enums<"app_role">[] = ["administracion"];

// DF-C4 §4: abre el período de cierre mensual para una obra social.
// C4-18: si no se carga un total a mano, se precarga el sugerido (valor vigente x módulos al día).
export async function createBillingPeriodAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración gestiona la facturación.");

  const supabase = await createClient();
  const obra_social_id = String(formData.get("obra_social_id") || "");
  const periodo = String(formData.get("periodo") || "");
  const total_facturado = formData.get("total_facturado") ? Number(formData.get("total_facturado")) : null;

  if (!obra_social_id || !periodo) return { error: "Elegí la obra social y el mes antes de abrir el período." };

  const { data: yaExiste } = await supabase
    .from("billing_periods")
    .select("id")
    .eq("obra_social_id", obra_social_id)
    .eq("periodo", `${periodo}-01`)
    .maybeSingle();
  if (yaExiste) return { error: "Ese mes ya está abierto para esa obra social. Buscalo en la lista de períodos." };

  const { data: nuevo, error } = await supabase
    .from("billing_periods")
    .insert({ obra_social_id, periodo: `${periodo}-01`, total_facturado })
    .select("id")
    .single();
  if (error || !nuevo) return { error: `No se pudo abrir el período: ${error?.message ?? "intentá de nuevo"}.` };

  let aviso = "Período abierto. Siguiente paso: revisá la pre-validación y avanzalo con los botones de su fila.";
  if (total_facturado == null) {
    const { data: sug } = await supabase
      .from("v_cierre_sugerido")
      .select("total_sugerido, modulos_verdes")
      .eq("billing_period_id", nuevo.id)
      .maybeSingle();
    if (sug?.total_sugerido && sug.total_sugerido > 0) {
      await supabase.from("billing_periods").update({ total_facturado: sug.total_sugerido }).eq("id", nuevo.id);
      aviso = `Período abierto con un total sugerido de ${formatARS(sug.total_sugerido)} (${sug.modulos_verdes} módulo(s) al día). Podés corregirlo en la fila del período.`;
    }
  }
  revalidatePath("/facturacion");
  await flash(aviso);
  return null;
}

// Semáforo de cierre: abierto -> en_revision -> cerrado -> facturado (DF-C4 §4).
export async function advanceBillingPeriodAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const nuevo_estado = String(formData.get("nuevo_estado") || "") as Enums<"billing_period_status">;
  if (!billing_period_id || !nuevo_estado) throw new Error("Faltan datos.");

  // DF-C4 §4/§9: no se puede cerrar un período con pacientes en rojo (faltan evoluciones, días de
  // más, días no autorizados, exceso). Se corrigen, o se dejan fuera del cierre (C4-38).
  if (nuevo_estado === "cerrado") {
    const { data: resumen } = await supabase
      .from("v_prevalidacion_resumen")
      .select("pacientes_rojos_pendientes, bloqueado_efectivo")
      .eq("billing_period_id", billing_period_id)
      .maybeSingle();
    if (resumen?.bloqueado_efectivo) {
      throw new Error(
        `No se puede cerrar el período: hay ${resumen.pacientes_rojos_pendientes} paciente(s) con controles en rojo. Abrí «Pre-validación», corregilos o dejalos fuera de este cierre, y volvé a intentar.`
      );
    }
  }

  const patch: TablesUpdate<"billing_periods"> = { estado: nuevo_estado };
  let totalAutomatico: number | null = null;
  if (nuevo_estado === "cerrado") {
    patch.fecha_cierre = new Date().toISOString();
    patch.cerrado_por = profile.id;
    // C4-18: si no hay total cargado, se completa con el sugerido (editable después en la fila).
    const [{ data: per }, { data: sug }] = await Promise.all([
      supabase.from("billing_periods").select("total_facturado").eq("id", billing_period_id).maybeSingle(),
      supabase.from("v_cierre_sugerido").select("total_sugerido").eq("billing_period_id", billing_period_id).maybeSingle(),
    ]);
    if (per && per.total_facturado == null && sug?.total_sugerido && sug.total_sugerido > 0) {
      patch.total_facturado = sug.total_sugerido;
      totalAutomatico = sug.total_sugerido;
    }
  }
  // DF-C4 §11: Cobrada/Debitada/En gestión, continuación de "facturado"
  // (= Presentada) — se registra cuándo se actualizó el estado de cobro.
  if (nuevo_estado === "cobrada" || nuevo_estado === "debitada" || nuevo_estado === "en_gestion") {
    patch.fecha_cobro = hoyAR();
    patch.cobro_actualizado_por = profile.id;
  }

  const { error } = await supabase.from("billing_periods").update(patch).eq("id", billing_period_id);
  if (error) throw new Error(`No se pudo actualizar el período: ${error.message}.`);
  revalidatePath("/facturacion");
  const AVISOS: Record<string, string> = {
    en_revision: "Período en revisión. Siguiente paso: revisá la pre-validación y, cuando esté todo en verde, cerralo.",
    cerrado: `Período cerrado${totalAutomatico != null ? ` con un total de ${formatARS(totalAutomatico)} (sugerido, podés corregirlo)` : ""}. Siguiente paso: presentalo a la obra social y marcalo como presentado.`,
    facturado: "Período marcado como presentado. Siguiente paso: cuando la obra social responda, marcalo como cobrado o debitado.",
    cobrada: "Período marcado como cobrado. Si pagaron un monto distinto del facturado, cargalo en «Registrar monto cobrado».",
    debitada: "Período marcado como debitado. Siguiente paso: cargá cada débito y ponelo en gestión.",
    en_gestion: "Período en gestión. Cuando se resuelva el reclamo, marcalo como cobrado.",
  };
  await flash(AVISOS[nuevo_estado] ?? "Período actualizado.");
  return;
}

// DF-C4 §11: registra el monto efectivamente cobrado cuando difiere del
// total facturado (ej. cobro parcial tras un débito).
export async function registerMontoCobradoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const monto_cobrado = Number(formData.get("monto_cobrado") || 0);
  if (!billing_period_id || !monto_cobrado) throw new Error("Faltan datos del cobro.");

  const { error } = await supabase
    .from("billing_periods")
    .update({ monto_cobrado, fecha_cobro: hoyAR(), cobro_actualizado_por: profile.id })
    .eq("id", billing_period_id);
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  await flash("Monto cobrado registrado.");
  return;
}

// DF-C4 §6: gestión de débitos/glosas de obra social.
export async function addBillingDebitAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const patient_id = String(formData.get("patient_id") || "") || null;
  const motivo = String(formData.get("motivo") || "").trim();
  const monto = Number(formData.get("monto") || 0);

  if (!billing_period_id || !motivo || !monto) throw new Error("Faltan datos del débito.");

  const { error } = await supabase.from("billing_debits").insert({ billing_period_id, patient_id, motivo, monto, gestionado_por: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  await flash("Débito registrado.");
  return;
}

export async function updateDebitStatusAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("No autorizado.");

  const supabase = await createClient();
  const debit_id = Number(formData.get("debit_id"));
  const estado = String(formData.get("estado") || "") as Enums<"debit_status">;
  if (!debit_id || !estado) throw new Error("Faltan datos.");

  const { error } = await supabase.from("billing_debits").update({ estado, gestionado_por: profile.id }).eq("id", debit_id);
  if (error) throw new Error(error.message);
  revalidatePath("/facturacion");
  await flash("Débito actualizado.");
  return;
}

// C4-18: corregir a mano el total de un período que todavía no se presentó.
export async function updateBillingTotalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración corrige el total de un período.");

  const supabase = await createClient();
  const billing_period_id = String(formData.get("billing_period_id") || "");
  const total = Number(formData.get("total_facturado") || 0);
  if (!billing_period_id || !(total > 0)) return { error: "Escribí un total mayor a cero." };

  const { data: per } = await supabase.from("billing_periods").select("estado").eq("id", billing_period_id).maybeSingle();
  if (!per) return { error: "No encontramos ese período. Recargá la página." };
  if (!["abierto", "en_revision", "cerrado"].includes(per.estado)) {
    return { error: "Este período ya se presentó: el total facturado no se puede cambiar. Si cobraron otro monto, usá «Registrar monto cobrado»." };
  }

  const { error } = await supabase.from("billing_periods").update({ total_facturado: total }).eq("id", billing_period_id);
  if (error) return { error: `No se pudo guardar el total: ${error.message}.` };
  revalidatePath("/facturacion");
  await flash(`Total del período guardado: ${formatARS(total)}.`);
  return null;
}

// C4-38: dejar a un paciente en rojo fuera del cierre del mes (se presentan los demás) o volver a incluirlo.
async function periodoEditableParaExclusiones(billing_period_id: string) {
  const supabase = await createClient();
  const { data: per } = await supabase.from("billing_periods").select("estado").eq("id", billing_period_id).maybeSingle();
  if (!per) throw new Error("No encontramos ese período. Recargá la página.");
  if (!["abierto", "en_revision", "cerrado"].includes(per.estado)) {
    throw new Error("Este período ya se presentó: no se pueden cambiar los pacientes incluidos.");
  }
  return supabase;
}

export async function excludePatientFromPeriodAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración deja pacientes fuera del cierre mensual.");

  const billing_period_id = String(formData.get("billing_period_id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  const motivo = String(formData.get("motivo") || "").trim() || null;
  if (!billing_period_id || !patient_id) throw new Error("Faltan datos para dejar al paciente fuera del cierre.");

  const supabase = await periodoEditableParaExclusiones(billing_period_id);
  const { error } = await supabase
    .from("billing_period_exclusions")
    .upsert({ billing_period_id, patient_id, motivo, excluido_por: profile.id }, { onConflict: "billing_period_id,patient_id" });
  if (error) throw new Error(`No se pudo dejar al paciente fuera del cierre: ${error.message}.`);
  revalidatePath("/facturacion");
  await flash("Paciente fuera de este cierre: no se factura este mes y ya no bloquea el cierre. Si lo corregís, podés volver a incluirlo.");
  return;
}

export async function includePatientInPeriodAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración deja pacientes fuera del cierre mensual.");

  const billing_period_id = String(formData.get("billing_period_id") || "");
  const patient_id = String(formData.get("patient_id") || "");
  if (!billing_period_id || !patient_id) throw new Error("Faltan datos para volver a incluir al paciente.");

  const supabase = await periodoEditableParaExclusiones(billing_period_id);
  const { error } = await supabase.from("billing_period_exclusions").delete().eq("billing_period_id", billing_period_id).eq("patient_id", patient_id);
  if (error) throw new Error(`No se pudo volver a incluir al paciente: ${error.message}.`);
  revalidatePath("/facturacion");
  await flash("Paciente incluido de nuevo en el cierre. Si todavía tiene controles en rojo, vuelve a bloquear el cierre.");
  return;
}

// C4-44: si el débito se puede reclamar, cuándo se volvió a presentar y notas de la gestión.
export async function updateDebitResubmisionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireProfile();
  if (!BILLING_ROLES.includes(profile.role)) throw new Error("Solo Administración registra el reclamo de un débito.");

  const supabase = await createClient();
  const debit_id = Number(formData.get("debit_id"));
  if (!debit_id) return { error: "Falta el débito. Recargá la página." };
  const reclamable = formData.get("reclamable") === "on";
  const fecha_resubmision = String(formData.get("fecha_resubmision") || "") || null;
  const resubmision_notas = String(formData.get("resubmision_notas") || "").trim() || null;

  const { error } = await supabase
    .from("billing_debits")
    .update({ reclamable, fecha_resubmision, resubmision_notas, gestionado_por: profile.id })
    .eq("id", debit_id);
  if (error) return { error: `No se pudo guardar el reclamo: ${error.message}.` };
  revalidatePath("/facturacion");
  await flash(
    fecha_resubmision
      ? "Reclamo registrado. Siguiente paso: cuando la obra social responda, marcá el débito como resuelto o perdido."
      : "Datos del reclamo guardados. Cuando lo vuelvas a presentar, cargá la fecha."
  );
  return null;
}
