"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

// Depósito arma el pedido (DF-C5 §4, paso 3). Si ya existe un pedido en
// borrador para ese paciente, se le agrega el ítem; si no, se crea uno.
//
// Validación condicional (comentario cliente 25/09): revalidar cada salida
// de algo ya fijo/preestablecido sería una pérdida de tiempo. La validación
// de Administración aplica solo a (a) modificaciones sobre lo mensual/fijo
// autorizado, y (b) ítems no cubiertos por la autorización estándar vigente
// del paciente. Si TODOS los ítems del pedido están cubiertos por una
// patient_authorizations vigente (mismo producto, cantidad <= autorizada),
// el pedido queda autorizado automáticamente y puede despacharse directo,
// sin pasar por el click manual de Administración.
export async function addOrderItemAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito arma pedidos.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const product_id = String(formData.get("product_id") || "");
  const equipment_asset_id = String(formData.get("equipment_asset_id") || "") || null;
  const cantidad = Number(formData.get("cantidad") || 1);
  // DF-C5 §4.3: canal de entrega y prioridad solo se piden al CREAR el
  // pedido (primer ítem) — si ya existe un borrador, se respeta lo que se
  // eligió al iniciarlo.
  const canal_entrega = (String(formData.get("canal_entrega") || "domicilio")) as Enums<"order_delivery_channel">;
  const prioridad = (String(formData.get("prioridad") || "normal")) as Enums<"order_priority">;

  if (!patient_id || !product_id) throw new Error("Faltan paciente o producto.");

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("patient_id", patient_id)
    .eq("estado", "borrador")
    .maybeSingle();

  let orderId = existing?.id;

  if (!orderId) {
    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert({ patient_id, creado_por: profile.id, estado: "borrador", canal_entrega, prioridad })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    orderId = newOrder.id;
  }

  const { error: itemError } = await supabase
    .from("order_items")
    .insert({ order_id: orderId, product_id, cantidad, equipment_asset_id });

  if (itemError) throw new Error(itemError.message);

  await tryAutoAuthorize(supabase, orderId, patient_id);

  revalidatePath("/pedidos");
  return;
}

// Revisa si TODOS los ítems del pedido están cubiertos por autorizaciones
// estándar vigentes del paciente; si es así, autoriza automáticamente.
async function tryAutoAuthorize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  patientId: string
) {
  const [{ data: items }, { data: authorizations }] = await Promise.all([
    supabase.from("order_items").select("product_id, cantidad").eq("order_id", orderId),
    supabase
      .from("patient_authorizations")
      .select("product_id, cantidad_autorizada, vigente_desde, vigente_hasta")
      .eq("patient_id", patientId),
  ]);

  if (!items || items.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const cubierto = items.every((item) => {
    const auth = (authorizations ?? []).find((a) => {
      if (a.product_id !== item.product_id) return false;
      if (a.vigente_desde && a.vigente_desde > today) return false;
      if (a.vigente_hasta && a.vigente_hasta < today) return false;
      return true;
    });
    return auth != null && item.cantidad <= auth.cantidad_autorizada;
  });

  if (!cubierto) return;

  await supabase
    .from("orders")
    .update({
      estado: "autorizado",
      autorizado_por: null,
      autorizacion_automatica: true,
      fecha_autorizacion: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("estado", "borrador");
}

// Administración autoriza manualmente un pedido que quedó pendiente de
// validación (modificación sobre lo fijo, o ítem no cubierto) — §4, paso 3.
export async function authorizeOrderAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración autoriza pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");

  const { error } = await supabase
    .from("orders")
    .update({
      estado: "autorizado",
      autorizado_por: profile.id,
      autorizacion_automatica: false,
      fecha_autorizacion: new Date().toISOString(),
    })
    .eq("id", order_id)
    .eq("estado", "borrador");

  if (error) throw new Error(error.message);
  revalidatePath("/pedidos");
  revalidatePath("/internacion");
  return;
}

// Administración rechaza un pedido pendiente de validación — cierra el
// ciclo de "notificación de vuelta al coordinador (autorizado / no
// autorizado)" que pedía el cliente (comentario 25/09).
export async function rejectOrderAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración rechaza pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const motivo = String(formData.get("motivo_rechazo") || "").trim() || "No cubierto por la autorización vigente.";

  const { error } = await supabase
    .from("orders")
    .update({ estado: "cancelado", rechazado_por: profile.id, motivo_rechazo: motivo })
    .eq("id", order_id)
    .eq("estado", "borrador");

  if (error) throw new Error(error.message);
  revalidatePath("/pedidos");
  revalidatePath("/internacion");
  return;
}

// Depósito despacha: genera el remito digital (§4, paso 4).
export async function dispatchOrderAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito despacha pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");

  const { error: orderError } = await supabase
    .from("orders")
    .update({ estado: "despachado" })
    .eq("id", order_id)
    .eq("estado", "autorizado");

  if (orderError) throw new Error(orderError.message);

  const { error: remitoError } = await supabase
    .from("remitos")
    .insert({ order_id, fecha_despacho: new Date().toISOString() });

  if (remitoError) throw new Error(remitoError.message);

  revalidatePath("/pedidos");
  return;
}

// Entrega y firma del remito por el familiar (§4, pasos 4-5). Al confirmar,
// los equipos del pedido pasan a "asignado" y queda el movimiento
// registrado (vínculo con el seguimiento del punto 4.2).
//
// DF-C5 §4.3: canal "retiro_local" — el familiar retira en Depósito, sin
// tarea de Transporte, así que quien confirma la entrega es Depósito. Canal
// "domicilio" (default) sigue siendo Transporte, como antes.
export async function deliverOrderAction(formData: FormData) {
  const { profile } = await requireProfile();

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const firma = String(formData.get("firma_familiar") || "Firma digital confirmada");

  const { data: order } = await supabase
    .from("orders")
    .select("id, patient_id, estado, canal_entrega")
    .eq("id", order_id)
    .single();

  if (!order || order.estado !== "despachado") {
    throw new Error("El pedido no está en estado despachado.");
  }

  const roleOk =
    (order.canal_entrega === "retiro_local" && profile.role === "deposito") ||
    (order.canal_entrega === "domicilio" && profile.role === "transporte");
  if (!roleOk) {
    throw new Error(
      order.canal_entrega === "retiro_local"
        ? "Este pedido es por retiro en el local — lo confirma Depósito."
        : "Este pedido se entrega a domicilio — lo confirma Transporte."
    );
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("domicilio")
    .eq("id", order.patient_id)
    .single();

  const now = new Date().toISOString();

  await supabase
    .from("remitos")
    .update({
      transportista_id: profile.id,
      fecha_entrega: now,
      firma_familiar_url: firma,
      firmado_at: now,
      // DF-C5 §4.5: notificación al familiar al firmar el remito. Stub — este
      // mockup no tiene integración real de WhatsApp/email conectada; se
      // registra la intención (canal + fecha) para que el desarrollador
      // final la conecte sobre este mismo campo (ej. Twilio/WhatsApp
      // Business API + Resend).
      notificacion_enviada_at: now,
      notificacion_canal: "whatsapp+email",
    })
    .eq("order_id", order_id);

  await supabase.from("orders").update({ estado: "entregado" }).eq("id", order_id);

  const { data: items } = await supabase
    .from("order_items")
    .select("equipment_asset_id")
    .eq("order_id", order_id)
    .not("equipment_asset_id", "is", null);

  for (const item of items ?? []) {
    if (!item.equipment_asset_id) continue;
    await supabase
      .from("equipment_assets")
      .update({ estado: "asignado" })
      .eq("id", item.equipment_asset_id);

    await supabase.from("equipment_asset_movements").insert({
      asset_id: item.equipment_asset_id,
      tipo: "entrega_domicilio",
      patient_id: order.patient_id,
      domicilio_origen: "Depósito",
      domicilio_destino: patient?.domicilio ?? null,
      confirmado_por: profile.id,
      fecha: now,
    });
  }

  revalidatePath("/pedidos");
  revalidatePath("/seguimiento");
  return;
}
