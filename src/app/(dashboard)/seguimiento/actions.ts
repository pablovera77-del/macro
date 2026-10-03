"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

// Administración genera la alerta de egreso (DF-C5 §4, paso 6 / DF-C3 §11)
// y arma automáticamente el checklist de retiro con los equipos que el
// paciente tiene asignados en ese momento.
export async function createDischargeAlertAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración genera el egreso.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const motivo = String(formData.get("motivo") || "") as Enums<"discharge_reason">;

  if (!patient_id || !motivo) throw new Error("Faltan paciente o motivo.");

  const { data: alert, error } = await supabase
    .from("discharge_alerts")
    .insert({ patient_id, motivo, generado_por: profile.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: assignedAssets } = await supabase
    .from("v_equipos_en_domicilio")
    .select("asset_id")
    .eq("patient_id", patient_id);

  if (assignedAssets && assignedAssets.length > 0) {
    await supabase.from("retrieval_checklist").insert(
      assignedAssets
        .filter((a) => a.asset_id)
        .map((a) => ({ discharge_alert_id: alert.id, asset_id: a.asset_id as string }))
    );
  }

  revalidatePath("/seguimiento");
  return;
}

// Transporte marca el retiro del equipo del domicilio (primer check, §4.2).
// DF-C5 §4.3 (ronda 29/09): foto obligatoria al retirar — antes la tabla
// equipment_asset_photos existía pero no estaba conectada a ningún action.
export async function markRetiradoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte") throw new Error("Solo Transporte marca el retiro.");

  const supabase = await createClient();
  const checklist_id = Number(formData.get("checklist_id"));
  const foto_url = String(formData.get("foto_url") || "").trim();
  if (!foto_url) throw new Error("La foto del equipo al momento del retiro es obligatoria.");

  const { data: item } = await supabase
    .from("retrieval_checklist")
    .select("asset_id, discharge_alert_id, discharge_alerts(patient_id)")
    .eq("id", checklist_id)
    .single();

  if (!item) throw new Error("No se encontró el ítem del checklist.");

  const now = new Date().toISOString();

  await supabase
    .from("retrieval_checklist")
    .update({ retirado_at: now, retirado_por: profile.id, foto_url })
    .eq("id", checklist_id);

  await supabase
    .from("discharge_alerts")
    .update({ estado: "retiro_informado" })
    .eq("id", item.discharge_alert_id);

  if (item.asset_id) {
    await supabase.from("equipment_asset_photos").insert({ asset_id: item.asset_id, momento: "retiro", url: foto_url });

    await supabase.from("equipment_asset_movements").insert({
      asset_id: item.asset_id,
      tipo: "retiro_domicilio",
      patient_id: (item.discharge_alerts as unknown as { patient_id: string } | null)?.patient_id ?? null,
      domicilio_origen: "Domicilio del paciente",
      domicilio_destino: "En tránsito a depósito",
      confirmado_por: profile.id,
      fecha: now,
    });
  }

  revalidatePath("/seguimiento");
  return;
}

// DF-C5 §4.3 (ronda 29/09): devolución de descartables/alimentos no
// utilizados al egreso del paciente. A diferencia de los equipos (que ya
// tienen su fila de checklist auto-generada por createDischargeAlertAction,
// porque el sistema sabe qué unidad serializada tiene asignada cada
// paciente), un descartable/alimento no se "asigna" — nadie sabe de
// antemano cuánto va a sobrar. Por eso Transporte reporta la devolución y
// la marca retirada en un solo paso, en vez de un checklist pre-armado.
export async function reportDiscardableReturnAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte") throw new Error("Solo Transporte reporta devoluciones de descartables/alimentos.");

  const supabase = await createClient();
  const discharge_alert_id = String(formData.get("discharge_alert_id") || "");
  const product_id = String(formData.get("product_id") || "");
  const cantidad = Number(formData.get("cantidad") || 0);
  const foto_url = String(formData.get("foto_url") || "").trim();

  if (!discharge_alert_id || !product_id || !cantidad || cantidad <= 0) {
    throw new Error("Faltan datos de la devolución (egreso, producto o cantidad).");
  }
  if (!foto_url) throw new Error("La foto de lo devuelto es obligatoria.");

  const { error } = await supabase.from("retrieval_checklist").insert({
    discharge_alert_id,
    product_id,
    cantidad,
    foto_url,
    retirado_at: new Date().toISOString(),
    retirado_por: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/seguimiento");
  return;
}

// Depósito confirma la llegada — cierra el doble check del punto 4.2 y
// libera el equipo (vuelve a "disponible").
export async function confirmLlegadaAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito confirma la llegada.");

  const supabase = await createClient();
  const checklist_id = Number(formData.get("checklist_id"));

  const { data: item } = await supabase
    .from("retrieval_checklist")
    .select("asset_id, product_id, cantidad, discharge_alert_id")
    .eq("id", checklist_id)
    .single();

  if (!item) throw new Error("No se encontró el ítem del checklist.");

  const now = new Date().toISOString();

  await supabase
    .from("retrieval_checklist")
    .update({ llego_deposito_at: now, llego_deposito_confirmado_por: profile.id })
    .eq("id", checklist_id);

  if (item.asset_id) {
    await supabase.from("equipment_assets").update({ estado: "disponible" }).eq("id", item.asset_id);

    await supabase.from("equipment_asset_movements").insert({
      asset_id: item.asset_id,
      tipo: "llegada_deposito",
      domicilio_origen: "En tránsito",
      domicilio_destino: "Depósito",
      confirmado_por: profile.id,
      fecha: now,
    });
  } else if (item.product_id && item.cantidad) {
    // DF-C5 §4.3: devolución de descartable/alimento — se re-acredita al
    // stock como un ajuste positivo (mismo trigger que ya aplica
    // ingreso_compra/ajuste sobre products.existencia_actual).
    await supabase.from("stock_movements").insert({
      product_id: item.product_id,
      tipo: "ajuste",
      cantidad: item.cantidad,
      motivo: "Devolución de descartable/alimento no utilizado — egreso de paciente",
      confirmado_por: profile.id,
    });
  }

  const { data: pending } = await supabase
    .from("retrieval_checklist")
    .select("id")
    .eq("discharge_alert_id", item.discharge_alert_id)
    .is("llego_deposito_at", null);

  if (!pending || pending.length === 0) {
    await supabase.from("discharge_alerts").update({ estado: "cerrado" }).eq("id", item.discharge_alert_id);
  }

  revalidatePath("/seguimiento");
  return;
}
