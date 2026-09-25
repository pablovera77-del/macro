"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const COMPRAS_ROLES = ["deposito", "administracion"] as const;

// DF-C5 §6 (agregado): a partir de la proyección de compras (consumo
// mensual proyectado, cantidad de pacientes y lo que cada uno tiene
// autorizado), genera automáticamente el pedido de cotización a los
// proveedores habituales.
export async function generateQuoteRequestAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COMPRAS_ROLES.includes(profile.role as (typeof COMPRAS_ROLES)[number])) {
    throw new Error("No autorizado para generar cotizaciones.");
  }

  const supabase = await createClient();

  const productIds = formData.getAll("product_id").map(String);
  const cantidades = formData.getAll("cantidad_sugerida").map(Number);

  if (productIds.length === 0) throw new Error("No hay productos seleccionados para cotizar.");

  const { data: quoteRequest, error } = await supabase
    .from("quote_requests")
    .insert({ estado: "borrador", notas: "Generado automáticamente desde la proyección de compras (DF-C5 §6).", creado_por: profile.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const items = productIds.map((product_id, i) => ({
    quote_request_id: quoteRequest.id,
    product_id,
    cantidad: Math.max(1, cantidades[i] || 1),
  }));

  const { error: itemsError } = await supabase.from("quote_request_items").insert(items);
  if (itemsError) throw new Error(itemsError.message);

  // "Enviada" simula el envío del pedido de cotización a los mails
  // precargados de los proveedores habituales (§6, agregado).
  await supabase.from("quote_requests").update({ estado: "enviada" }).eq("id", quoteRequest.id);

  revalidatePath("/compras");
  return;
}

// Registra el precio cotizado por un proveedor para un ítem de la
// cotización — arma la comparativa de precios por proveedor (§6).
export async function logSupplierQuoteAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COMPRAS_ROLES.includes(profile.role as (typeof COMPRAS_ROLES)[number])) {
    throw new Error("No autorizado.");
  }

  const supabase = await createClient();
  const quote_request_id = String(formData.get("quote_request_id") || "");
  const product_id = String(formData.get("product_id") || "");
  const supplier_id = String(formData.get("supplier_id") || "");
  const precio = Number(formData.get("precio") || 0);

  if (!quote_request_id || !product_id || !supplier_id || !precio) {
    throw new Error("Faltan datos de la cotización del proveedor.");
  }

  const { error } = await supabase.from("supplier_price_quotes").insert({
    quote_request_id,
    product_id,
    supplier_id,
    precio,
  });

  if (error) throw new Error(error.message);

  await supabase.from("quote_requests").update({ estado: "respondida" }).eq("id", quote_request_id).eq("estado", "enviada");

  revalidatePath("/compras");
  return;
}

// Genera la orden de compra directamente desde el sistema, eligiendo por
// cada ítem el proveedor con el precio más bajo cotizado (o el preferido si
// nadie cotizó todavía) — cierra el ciclo de comparativa → orden de compra (§6).
export async function generatePurchaseOrdersAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!COMPRAS_ROLES.includes(profile.role as (typeof COMPRAS_ROLES)[number])) {
    throw new Error("No autorizado.");
  }

  const supabase = await createClient();
  const quote_request_id = String(formData.get("quote_request_id") || "");
  if (!quote_request_id) throw new Error("Falta la cotización.");

  const [{ data: items }, { data: quotes }, { data: preferredSuppliers }] = await Promise.all([
    supabase.from("quote_request_items").select("product_id, cantidad").eq("quote_request_id", quote_request_id),
    supabase.from("supplier_price_quotes").select("product_id, supplier_id, precio").eq("quote_request_id", quote_request_id),
    supabase.from("product_suppliers").select("product_id, supplier_id, precio_referencia").eq("preferido", true),
  ]);

  if (!items || items.length === 0) throw new Error("La cotización no tiene ítems.");

  // Por cada producto, elegimos el proveedor con el precio más bajo cotizado;
  // si nadie cotizó todavía, caemos al proveedor preferido del catálogo.
  const winners = new Map<string, { supplier_id: string; precio: number | null }>();
  for (const item of items) {
    const productQuotes = (quotes ?? []).filter((q) => q.product_id === item.product_id);
    if (productQuotes.length > 0) {
      const cheapest = productQuotes.reduce((a, b) => (b.precio < a.precio ? b : a));
      winners.set(item.product_id, { supplier_id: cheapest.supplier_id, precio: cheapest.precio });
    } else {
      const preferred = (preferredSuppliers ?? []).find((p) => p.product_id === item.product_id);
      if (preferred) {
        winners.set(item.product_id, { supplier_id: preferred.supplier_id, precio: preferred.precio_referencia });
      }
    }
  }

  // Agrupamos por proveedor ganador — una orden de compra por proveedor.
  const bySupplier = new Map<string, { product_id: string; cantidad: number; precio: number | null }[]>();
  for (const item of items) {
    const winner = winners.get(item.product_id);
    if (!winner) continue;
    const list = bySupplier.get(winner.supplier_id) ?? [];
    list.push({ product_id: item.product_id, cantidad: item.cantidad, precio: winner.precio });
    bySupplier.set(winner.supplier_id, list);
  }

  if (bySupplier.size === 0) {
    throw new Error("Ningún ítem tiene proveedor cotizado o preferido — cargá al menos una cotización.");
  }

  for (const [supplier_id, orderItems] of bySupplier) {
    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({ supplier_id, estado: "borrador", creado_por: profile.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("purchase_order_items").insert(
      orderItems.map((it) => ({
        purchase_order_id: po.id,
        product_id: it.product_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio,
      }))
    );
  }

  await supabase.from("quote_requests").update({ estado: "cerrada" }).eq("id", quote_request_id);

  revalidatePath("/compras");
  return;
}

export async function advancePurchaseOrderAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito gestiona la recepción de órdenes de compra.");

  const supabase = await createClient();
  const purchase_order_id = String(formData.get("purchase_order_id") || "");
  const nuevo_estado = String(formData.get("nuevo_estado") || "");
  if (!purchase_order_id || !nuevo_estado) throw new Error("Faltan datos.");

  const patch: { estado: "enviada" | "confirmada" | "recibida"; fecha_recepcion?: string } = {
    estado: nuevo_estado as "enviada" | "confirmada" | "recibida",
  };
  if (nuevo_estado === "recibida") patch.fecha_recepcion = new Date().toISOString();

  const { error } = await supabase.from("purchase_orders").update(patch).eq("id", purchase_order_id);
  if (error) throw new Error(error.message);

  // Al recibir la orden, ingresa el stock (DF-C5 fix #6: mismo mecanismo
  // automático de stock_movements que usa el despacho de pedidos).
  if (nuevo_estado === "recibida") {
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("product_id, cantidad")
      .eq("purchase_order_id", purchase_order_id);

    for (const item of items ?? []) {
      await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        tipo: "ingreso_compra",
        cantidad: item.cantidad,
        motivo: `Recepción de orden de compra ${purchase_order_id}`,
        purchase_order_item_id: null,
        confirmado_por: profile.id,
      });
    }
  }

  revalidatePath("/compras");
  return;
}
