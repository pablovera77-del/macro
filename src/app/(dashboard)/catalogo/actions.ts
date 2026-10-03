"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Enums } from "@/types/database";

// DF-C5 §3, comentario cliente 25/09: alta manual del producto. El código de
// barras (EAN/UPC) es opcional — lo asigna el fabricante vía GS1, no todos
// los proveedores lo traen (productos fraccionados / proveedores chicos).
//
// DF-C5 §3, feedback cliente 01/10-02/10: stock mínimo/máximo (semáforo de
// reposición, ver vista v_products_status), fecha de vencimiento + n° de
// lote (obligatorios según tipo), y campos específicos de equipo/aparatología
// (alquiler, service). El EAN se valida contra el índice único parcial
// products_ean_unique_idx — si ya existe, se devuelve un mensaje claro en vez
// del error crudo de Postgres.
export async function createProductAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito carga el catálogo.");

  const supabase = await createClient();

  const codigo = String(formData.get("codigo") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const observacion = String(formData.get("observacion") || "").trim() || null;
  const tipo = String(formData.get("tipo") || "") as Enums<"product_type">;
  const ean = String(formData.get("ean") || "").trim() || null;
  const categoria_iva = String(formData.get("categoria_iva") || "21%") as Enums<"iva_category">;
  const se_factura_aparte = formData.get("se_factura_aparte") === "on";
  const precio = Number(formData.get("precio_compra") || 0);
  const supplier_id = String(formData.get("supplier_id") || "") || null;

  const stock_minimo = formData.get("stock_minimo") ? Number(formData.get("stock_minimo")) : null;
  const stock_maximo = formData.get("stock_maximo") ? Number(formData.get("stock_maximo")) : null;
  const fecha_vencimiento = String(formData.get("fecha_vencimiento") || "").trim() || null;
  const n_lote = String(formData.get("n_lote") || "").trim() || null;
  const precio_alquiler_mensual = formData.get("precio_alquiler_mensual") ? Number(formData.get("precio_alquiler_mensual")) : null;
  const frecuencia_service = String(formData.get("frecuencia_service") || "").trim() || null;
  const fecha_ultimo_service = String(formData.get("fecha_ultimo_service") || "").trim() || null;
  const vida_util_estimada = String(formData.get("vida_util_estimada") || "").trim() || null;

  if (!codigo || !descripcion || !tipo) {
    throw new Error("Faltan campos obligatorios (código, descripción, tipo).");
  }

  // DF-C5 §3: vencimiento obligatorio para descartable y alimento; lote solo para alimento.
  if ((tipo === "descartable" || tipo === "alimento") && !fecha_vencimiento) {
    throw new Error("La fecha de vencimiento es obligatoria para descartables y alimentos.");
  }
  if (tipo === "alimento" && !n_lote) {
    throw new Error("El N° de lote es obligatorio para alimentos.");
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      codigo,
      descripcion,
      observacion,
      tipo,
      ean,
      categoria_iva,
      se_factura_aparte,
      stock_minimo,
      stock_maximo,
      fecha_vencimiento: tipo === "equipo" ? null : fecha_vencimiento,
      n_lote: tipo === "alimento" ? n_lote : null,
      precio_alquiler_mensual: tipo === "equipo" ? precio_alquiler_mensual : null,
      frecuencia_service: tipo === "equipo" ? frecuencia_service : null,
      fecha_ultimo_service: tipo === "equipo" ? fecha_ultimo_service : null,
      vida_util_estimada: tipo === "equipo" ? vida_util_estimada : null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation — products_ean_unique_idx (EAN duplicado entre productos activos).
    if (error.code === "23505" && error.message.includes("ean")) {
      throw new Error(`Ya existe un producto activo con el EAN ${ean}. Revisá el catálogo antes de cargarlo de nuevo.`);
    }
    throw new Error(error.message);
  }

  if (precio > 0 && product) {
    await supabase.from("product_price_history").insert({
      product_id: product.id,
      precio_compra: precio,
    });
  }

  // Primer proveedor cargado queda como preferido por defecto (DF-C5 §3:
  // relación producto↔proveedor de varios a varios, con un preferido).
  if (supplier_id && product) {
    await supabase.from("product_suppliers").insert({
      product_id: product.id,
      supplier_id,
      preferido: true,
      precio_referencia: precio > 0 ? precio : null,
    });
  }

  revalidatePath("/catalogo");
  return;
}

export async function createAssetAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito carga unidades físicas.");

  const supabase = await createClient();

  const product_id = String(formData.get("product_id") || "");
  const numero_serie = String(formData.get("numero_serie") || "").trim();
  const propiedad = String(formData.get("propiedad") || "propio") as Enums<"ownership_type">;

  if (!product_id || !numero_serie) {
    throw new Error("Faltan campos obligatorios (equipo, número de serie).");
  }

  const { error } = await supabase.from("equipment_assets").insert({
    product_id,
    numero_serie,
    propiedad,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/catalogo");
  return;
}

// DF-C5 §3, comentario cliente 25/09: agregar más de un proveedor al mismo
// producto, marcando cuál es el preferido/predeterminado para la compra.
export async function addProductSupplierAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito gestiona proveedores del catálogo.");

  const supabase = await createClient();
  const product_id = String(formData.get("product_id") || "");
  const supplier_id = String(formData.get("supplier_id") || "");
  const precio_referencia = formData.get("precio_referencia") ? Number(formData.get("precio_referencia")) : null;
  const marcar_preferido = formData.get("preferido") === "on";

  if (!product_id || !supplier_id) throw new Error("Faltan producto o proveedor.");

  if (marcar_preferido) {
    // Solo puede haber un preferido por producto — se destraba el anterior.
    await supabase.from("product_suppliers").update({ preferido: false }).eq("product_id", product_id);
  }

  const { error } = await supabase
    .from("product_suppliers")
    .upsert(
      { product_id, supplier_id, preferido: marcar_preferido, precio_referencia },
      { onConflict: "product_id,supplier_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/catalogo");
  return;
}

// Cambia cuál es el proveedor preferido para un producto que ya tiene varios cargados.
export async function setPreferredSupplierAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") throw new Error("Solo Depósito gestiona proveedores del catálogo.");

  const supabase = await createClient();
  const product_id = String(formData.get("product_id") || "");
  const supplier_id = String(formData.get("supplier_id") || "");
  if (!product_id || !supplier_id) throw new Error("Faltan producto o proveedor.");

  await supabase.from("product_suppliers").update({ preferido: false }).eq("product_id", product_id);
  const { error } = await supabase
    .from("product_suppliers")
    .update({ preferido: true })
    .eq("product_id", product_id)
    .eq("supplier_id", supplier_id);

  if (error) throw new Error(error.message);
  revalidatePath("/catalogo");
  return;
}
