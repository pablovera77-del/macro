"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { flash } from "@/lib/flash";
import type { ActionState } from "@/lib/stock-types";

const OK: ActionState = { error: null };
const fail = (error: string): ActionState => ({ error });
const MES = /^\d{4}-\d{2}$/;
const primerDia = (mes: string) => `${mes}-01`;

// H8 (Vanina 06/10): Administración controla las historias clínicas del mes, arma el respaldo y marca «listo para facturar».
// Es un corte administrativo: NO da de baja al paciente. Con visitas sin evolución hay que dejar una observación.
export async function marcarListoParaFacturarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") return fail("Solo Administración marca a los pacientes como listos para facturar.");
  const supabase = await createClient();
  const mes = String(formData.get("mes") || "");
  const ids = formData.getAll("patient_id").map(String).filter(Boolean);
  const nota = String(formData.get("nota") || "").trim() || null;
  if (!MES.test(mes)) return fail("El mes no es válido.");
  if (ids.length === 0) return fail("Elegí al menos un paciente.");

  const desde = primerDia(mes);
  const hasta = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const { data: pend } = await supabase
    .from("v_visit_evolution_discrepancies")
    .select("patient_id")
    .in("patient_id", ids)
    .gte("fecha_programada", desde)
    .lte("fecha_programada", hasta);
  const conPendientes = new Set((pend ?? []).map((x) => x.patient_id));
  if (conPendientes.size > 0 && !nota) {
    return fail(`Hay ${conPendientes.size} paciente(s) con visitas realizadas sin evolución cargada. Pedí que se carguen o escribí una observación para marcarlos igual.`);
  }

  const { error } = await supabase.from("billing_ready").upsert(
    ids.map((patient_id) => ({
      patient_id,
      periodo: desde,
      marcado_por: profile.id,
      marcado_at: new Date().toISOString(),
      nota: conPendientes.has(patient_id) ? nota : null,
      revisado_por: null,
      revisado_at: null,
    })),
    { onConflict: "patient_id,periodo" }
  );
  if (error) return fail(`No se pudo guardar: ${error.message}`);
  revalidatePath("/listo-para-facturar");
  revalidatePath("/inicio");
  await flash(ids.length === 1 ? "Paciente marcado como listo para facturar. Facturación ya lo ve." : `${ids.length} pacientes marcados como listos para facturar. Facturación ya los ve.`);
  return OK;
}

// Administración se equivocó o aparecieron cambios: lo saca de «listo» mientras Facturación no lo revisó.
export async function desmarcarListoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración marca a los pacientes como listos para facturar.");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.from("billing_ready").delete().eq("id", id).is("revisado_at", null);
  if (error) throw new Error(`No se pudo quitar la marca: ${error.message}`);
  revalidatePath("/listo-para-facturar");
  await flash("Marca quitada. Si Facturación ya lo había revisado, no se puede quitar.");
}

// Facturación controla de nuevo lo que dejó Administración; queda registrado quién y cuándo.
export async function marcarRevisadoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "facturacion") throw new Error("Solo Facturación revisa lo que Administración dejó listo para facturar.");
  const supabase = await createClient();
  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (ids.length === 0) throw new Error("Elegí al menos un paciente.");
  const { error } = await supabase
    .from("billing_ready")
    .update({ revisado_por: profile.id, revisado_at: new Date().toISOString() })
    .in("id", ids)
    .is("revisado_at", null);
  if (error) throw new Error(`No se pudo guardar la revisión: ${error.message}`);
  revalidatePath("/listo-para-facturar");
  revalidatePath("/inicio");
  await flash(ids.length === 1 ? "Revisión registrada." : `${ids.length} revisiones registradas.`);
}
