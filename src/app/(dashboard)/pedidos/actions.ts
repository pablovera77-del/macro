"use server";

import { hoyAR } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { avisar } from "@/lib/order-notices";
import { subirFoto, esDataUrlImagen } from "@/lib/fotos";
import type { ActionState } from "@/lib/stock-types";
import type { Enums, TablesUpdate } from "@/types/database";

type Sb = Awaited<ReturnType<typeof createClient>>;

const OK: ActionState = { error: null };
const fail = (error: string): ActionState => ({ error });

function refrescar() {
  revalidatePath("/pedidos");
  revalidatePath("/seguimiento");
  revalidatePath("/agenda-transporte");
  revalidatePath("/inicio");
}

// ---------------------------------------------------------------------------------------------
// Armado del pedido (Depósito) — DF-C5 §4, paso 3.
//
// Si ya existe un pedido en borrador de Depósito para ese paciente (o profesional), se le agrega
// el ítem; si no, se crea uno. Validación condicional (comentario cliente 25/09): si TODOS los
// ítems están cubiertos por una autorización vigente del paciente (mismo producto, cantidad <=
// autorizada), el pedido queda autorizado solo y puede prepararse directo. Si no, espera a
// Administración. Un pedido para un profesional (R50) no tiene autorización de paciente: siempre
// pasa por Administración.
// ---------------------------------------------------------------------------------------------
export async function addOrderItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") return fail("Solo Depósito arma pedidos.");

  const supabase = await createClient();
  const destino = String(formData.get("destino") || "paciente");
  const patient_id = destino === "profesional" ? null : String(formData.get("patient_id") || "") || null;
  const profesional_id = destino === "profesional" ? String(formData.get("profesional_id") || "") || null : null;
  const product_id = String(formData.get("product_id") || "");
  const equipment_asset_id = String(formData.get("equipment_asset_id") || "") || null;
  const cantidad = Math.floor(Number(formData.get("cantidad") || 1));
  const canal_entrega = String(formData.get("canal_entrega") || "domicilio") as Enums<"order_delivery_channel">;
  const prioridad = String(formData.get("prioridad") || "normal") as Enums<"order_priority">;
  const motivo_urgencia = String(formData.get("motivo_urgencia") || "").trim() || null;
  const direccion_entrega = String(formData.get("direccion_entrega") || "").trim() || null;

  if (!patient_id && !profesional_id) return fail("Elegí para quién es el pedido (un paciente o un profesional).");
  if (!product_id) return fail("Elegí el producto que querés agregar.");
  if (!Number.isFinite(cantidad) || cantidad < 1) return fail("La cantidad tiene que ser 1 o más.");

  let q = supabase.from("orders").select("id").eq("estado", "borrador").eq("origen", "deposito");
  q = patient_id ? q.eq("patient_id", patient_id) : q.eq("profesional_id", profesional_id!);
  const { data: existing } = await q.limit(1).maybeSingle();

  let orderId = existing?.id;

  if (!orderId) {
    // Canal y prioridad solo se piden al crear (primer ítem); si ya hay borrador se respeta lo elegido.
    if (prioridad === "urgente" && !motivo_urgencia) return fail("Si el pedido es urgente, escribí el motivo.");
    if (profesional_id && canal_entrega === "domicilio" && !direccion_entrega) {
      return fail("Para entregar a un profesional a domicilio, indicá la dirección.");
    }
    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert({
        patient_id,
        profesional_id,
        creado_por: profile.id,
        estado: "borrador",
        canal_entrega,
        prioridad,
        motivo_urgencia: prioridad === "urgente" ? motivo_urgencia : null,
        direccion_entrega: profesional_id ? direccion_entrega : null,
        origen: "deposito",
      })
      .select("id")
      .single();
    if (error) return fail(`No se pudo crear el pedido: ${error.message}`);
    orderId = newOrder.id;
  }

  const { error: itemError } = await supabase
    .from("order_items")
    .insert({ order_id: orderId, product_id, cantidad, equipment_asset_id });
  if (itemError) return fail(`No se pudo agregar el ítem: ${itemError.message}`);

  const autorizado = await tryAutoAuthorize(supabase, orderId, patient_id);

  refrescar();
  await flash(
    autorizado
      ? "Ítem agregado. Todo está cubierto por la autorización del paciente: el pedido quedó autorizado. Siguiente paso: marcalo como preparado."
      : "Ítem agregado al pedido. Administración tiene que autorizarlo antes de prepararlo."
  );
  return OK;
}

// Revisa si TODOS los ítems vigentes (no rechazados) están cubiertos por autorizaciones del
// paciente; si es así, autoriza automáticamente. Devuelve si quedó autorizado.
async function tryAutoAuthorize(supabase: Sb, orderId: string, patientId: string | null): Promise<boolean> {
  if (!patientId) return false;
  const [{ data: items }, { data: authorizations }] = await Promise.all([
    supabase.from("order_items").select("product_id, cantidad, estado_item").eq("order_id", orderId),
    supabase
      .from("patient_authorizations")
      .select("product_id, cantidad_autorizada, vigente_desde, vigente_hasta")
      .eq("patient_id", patientId),
  ]);

  const vigentes = (items ?? []).filter((i) => i.estado_item !== "rechazado");
  if (vigentes.length === 0) return false;
  if (vigentes.some((i) => i.estado_item === "pendiente")) return false;

  const today = hoyAR();
  const cubierto = vigentes.every((item) => {
    const auth = (authorizations ?? []).find((a) => {
      if (a.product_id !== item.product_id) return false;
      if (a.vigente_desde && a.vigente_desde > today) return false;
      if (a.vigente_hasta && a.vigente_hasta < today) return false;
      return true;
    });
    return auth != null && item.cantidad <= auth.cantidad_autorizada;
  });
  if (!cubierto) return false;

  const { data } = await supabase
    .from("orders")
    .update({
      estado: "autorizado",
      autorizado_por: null,
      autorizacion_automatica: true,
      fecha_autorizacion: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("estado", "borrador")
    .select("id");
  return (data ?? []).length > 0;
}

async function itemsPendientes(supabase: Sb, orderId: string) {
  const { count } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("estado_item", "pendiente");
  return count ?? 0;
}

// Administración autoriza manualmente un pedido que quedó pendiente de validación (modificación
// sobre lo fijo, ítem no cubierto o pedido para un profesional) — §4, paso 3.
export async function authorizeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") return fail("Solo Administración autoriza pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");

  if ((await itemsPendientes(supabase, order_id)) > 0) {
    return fail("Depósito todavía no revisó todos los ítems de esta solicitud. Esperá a que la revise antes de autorizar.");
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      estado: "autorizado",
      autorizado_por: profile.id,
      autorizacion_automatica: false,
      fecha_autorizacion: new Date().toISOString(),
    })
    .eq("id", order_id)
    .eq("estado", "borrador")
    .select("id, creado_por, patient_id");

  if (error) return fail(`No se pudo autorizar el pedido: ${error.message}`);
  if (!data || data.length === 0) return fail("El pedido ya no está pendiente de autorización. Actualizá la pantalla.");

  await avisar(supabase, profile.id, {
    user: data[0].creado_por,
    tipo: "pedido_autorizado",
    titulo: "Tu pedido fue autorizado",
    detalle: "Administración lo autorizó. Depósito lo prepara.",
    href: "/pedidos",
    order_id,
    patient_id: data[0].patient_id,
  });
  await avisar(supabase, profile.id, {
    rol: "deposito",
    tipo: "pedido_autorizado",
    titulo: "Hay un pedido autorizado para preparar",
    href: "/pedidos",
    order_id,
    patient_id: data[0].patient_id,
  });

  refrescar();
  revalidatePath("/internacion");
  await flash("Pedido autorizado. Siguiente paso: Depósito lo prepara.");
  return OK;
}

// Administración rechaza un pedido pendiente de validación — cierra el ciclo de "notificación de
// vuelta al coordinador (autorizado / no autorizado)" que pedía el cliente (comentario 25/09).
export async function rejectOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") return fail("Solo Administración rechaza pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const motivo = String(formData.get("motivo_rechazo") || "").trim() || "No cubierto por la autorización vigente.";

  const { data, error } = await supabase
    .from("orders")
    .update({ estado: "cancelado", rechazado_por: profile.id, motivo_rechazo: motivo })
    .eq("id", order_id)
    .eq("estado", "borrador")
    .select("id, creado_por, patient_id");

  if (error) return fail(`No se pudo rechazar el pedido: ${error.message}`);
  if (!data || data.length === 0) return fail("El pedido ya no está pendiente de autorización. Actualizá la pantalla.");

  await avisar(supabase, profile.id, {
    user: data[0].creado_por,
    tipo: "pedido_rechazado",
    titulo: "Tu pedido no fue autorizado",
    detalle: `Motivo: ${motivo}`,
    href: "/pedidos",
    order_id,
    patient_id: data[0].patient_id,
  });

  refrescar();
  revalidatePath("/internacion");
  await flash("Pedido rechazado. Quien lo pidió ve el motivo.");
  return OK;
}

// ---------------------------------------------------------------------------------------------
// Solicitud de Coordinación (R05) y revisión de Depósito ítem por ítem (R06, R07).
// ---------------------------------------------------------------------------------------------
export async function solicitarInsumosAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "coordinador_internacion") return fail("Solo Coordinación solicita insumos.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const canal_entrega = String(formData.get("canal_entrega") || "domicilio") as Enums<"order_delivery_channel">;
  const prioridad = String(formData.get("prioridad") || "normal") as Enums<"order_priority">;
  const motivo_urgencia = String(formData.get("motivo_urgencia") || "").trim() || null;

  const productIds = formData.getAll("product_id").map(String);
  const cantidades = formData.getAll("cantidad").map((c) => Math.floor(Number(c)));

  if (!patient_id) return fail("Elegí el paciente para el que pedís los insumos.");
  if (prioridad === "urgente" && !motivo_urgencia) return fail("Si la solicitud es urgente, escribí el motivo.");

  // Se juntan las líneas repetidas del mismo producto y se descartan las vacías.
  const lineas = new Map<string, number>();
  productIds.forEach((pid, i) => {
    if (!pid) return;
    const c = cantidades[i];
    if (!Number.isFinite(c) || c < 1) return;
    lineas.set(pid, (lineas.get(pid) ?? 0) + c);
  });
  if (lineas.size === 0) return fail("Sumá al menos un producto con su cantidad.");

  const { data: paciente } = await supabase.from("patients").select("nombre_completo").eq("id", patient_id).maybeSingle();
  if (!paciente) return fail("No encontramos al paciente. Actualizá la pantalla e intentá de nuevo.");

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      patient_id,
      creado_por: profile.id,
      estado: "borrador",
      origen: "solicitud",
      canal_entrega,
      prioridad,
      motivo_urgencia: prioridad === "urgente" ? motivo_urgencia : null,
    })
    .select("id")
    .single();
  if (error) return fail(`No se pudo crear la solicitud: ${error.message}`);

  const { error: itemsError } = await supabase.from("order_items").insert(
    Array.from(lineas.entries()).map(([product_id, cantidad]) => ({
      order_id: order.id,
      product_id,
      cantidad,
      cantidad_solicitada: cantidad,
      estado_item: "pendiente",
    }))
  );
  if (itemsError) {
    await supabase.from("orders").update({ estado: "cancelado", motivo_rechazo: "Solicitud incompleta." }).eq("id", order.id);
    return fail(`No se pudieron cargar los productos de la solicitud: ${itemsError.message}`);
  }

  await avisar(supabase, profile.id, {
    rol: "deposito",
    tipo: "solicitud_nueva",
    titulo: `Nueva solicitud de insumos para ${paciente.nombre_completo}`,
    detalle: `${lineas.size} producto${lineas.size === 1 ? "" : "s"}${prioridad === "urgente" ? ` · URGENTE: ${motivo_urgencia}` : ""}. Revisá cada ítem y aceptalo, ajustalo o rechazalo.`,
    href: "/pedidos",
    order_id: order.id,
    patient_id,
  });

  refrescar();
  await flash("Solicitud enviada a Depósito. Cuando la revise te llega el aviso con lo aceptado y lo rechazado.");
  return OK;
}

export async function cancelSolicitudAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "coordinador_internacion") return fail("Solo Coordinación cancela sus solicitudes.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const { data, error } = await supabase
    .from("orders")
    .update({ estado: "cancelado", motivo_rechazo: "Cancelada por quien la pidió." })
    .eq("id", order_id)
    .eq("estado", "borrador")
    .eq("origen", "solicitud")
    .eq("creado_por", profile.id)
    .select("id");
  if (error) return fail(`No se pudo cancelar la solicitud: ${error.message}`);
  if (!data || data.length === 0) return fail("Solo se pueden cancelar tus solicitudes que todavía no se autorizaron.");

  refrescar();
  await flash("Solicitud cancelada.");
  return OK;
}

export async function reviewItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") return fail("Solo Depósito revisa las solicitudes.");

  const supabase = await createClient();
  const item_id = Number(formData.get("item_id"));
  const decision = String(formData.get("decision") || "");
  const motivo = String(formData.get("motivo") || "").trim();

  const { data: item } = await supabase
    .from("order_items")
    .select("id, order_id, cantidad, cantidad_solicitada, estado_item, orders(estado)")
    .eq("id", item_id)
    .maybeSingle();
  if (!item) return fail("No encontramos ese ítem. Actualizá la pantalla.");
  const ordenEstado = (item.orders as unknown as { estado: string } | null)?.estado;
  if (ordenEstado !== "borrador") return fail("Este pedido ya no está en revisión.");

  const base = { revisado_por: profile.id, revisado_at: new Date().toISOString() };
  let patch: TablesUpdate<"order_items">;
  if (decision === "aceptar") {
    patch = { ...base, estado_item: "aceptado", motivo: null };
  } else if (decision === "ajustar") {
    const nueva = Math.floor(Number(formData.get("cantidad")));
    if (!Number.isFinite(nueva) || nueva < 1) return fail("La cantidad ajustada tiene que ser 1 o más.");
    if (!motivo) return fail("Contá por qué ajustás la cantidad (por ejemplo, «solo hay 3 en depósito»).");
    patch = { ...base, estado_item: nueva === (item.cantidad_solicitada ?? item.cantidad) ? "aceptado" : "ajustado", cantidad: nueva, cantidad_solicitada: item.cantidad_solicitada ?? item.cantidad, motivo };
  } else if (decision === "rechazar") {
    if (!motivo) return fail("Escribí el motivo del rechazo; le llega a quien pidió.");
    patch = { ...base, estado_item: "rechazado", motivo };
  } else {
    return fail("No se entendió la decisión sobre el ítem.");
  }

  const { data: upd, error } = await supabase.from("order_items").update(patch).eq("id", item_id).select("id");
  if (error) return fail(`No se pudo guardar la revisión: ${error.message}`);
  if (!upd || upd.length === 0) return fail("No se pudo guardar la revisión. Actualizá la pantalla e intentá de nuevo.");

  await cerrarRevisionSiCorresponde(supabase, profile.id, item.order_id);
  refrescar();
  return OK;
}

export async function acceptAllItemsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") return fail("Solo Depósito revisa las solicitudes.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const { error } = await supabase
    .from("order_items")
    .update({ estado_item: "aceptado", revisado_por: profile.id, revisado_at: new Date().toISOString() })
    .eq("order_id", order_id)
    .eq("estado_item", "pendiente");
  if (error) return fail(`No se pudieron aceptar los ítems: ${error.message}`);

  await cerrarRevisionSiCorresponde(supabase, profile.id, order_id);
  refrescar();
  return OK;
}

// Cuando ya no quedan ítems pendientes: se avisa a quien pidió y el pedido sigue su camino
// (autorización automática si todo está cubierto; si no, queda para Administración; si se
// rechazó todo, se cierra).
async function cerrarRevisionSiCorresponde(supabase: Sb, userId: string, orderId: string) {
  if ((await itemsPendientes(supabase, orderId)) > 0) {
    await flash("Ítem revisado. Quedan ítems pendientes en esta solicitud.");
    return;
  }

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, estado, patient_id, creado_por, origen, patients(nombre_completo)")
      .eq("id", orderId)
      .single(),
    supabase.from("order_items").select("cantidad, cantidad_solicitada, estado_item, motivo, products(descripcion)").eq("order_id", orderId),
  ]);
  if (!order || order.estado !== "borrador") return;

  const lista = items ?? [];
  const vigentes = lista.filter((i) => i.estado_item !== "rechazado");
  const rechazados = lista.filter((i) => i.estado_item === "rechazado");
  const ajustados = lista.filter((i) => i.estado_item === "ajustado");
  const desc = (i: (typeof lista)[number]) => (i.products as unknown as { descripcion: string } | null)?.descripcion ?? "producto";
  const paciente = (order.patients as unknown as { nombre_completo: string } | null)?.nombre_completo ?? "el paciente";

  const partes: string[] = [];
  if (vigentes.length - ajustados.length > 0) partes.push(`${vigentes.length - ajustados.length} aceptado${vigentes.length - ajustados.length === 1 ? "" : "s"}`);
  for (const a of ajustados) partes.push(`${desc(a)}: ${a.cantidad} en vez de ${a.cantidad_solicitada} (${a.motivo})`);
  for (const r of rechazados) partes.push(`${desc(r)} rechazado (${r.motivo})`);
  const resumen = partes.join(" · ");

  if (vigentes.length === 0) {
    await supabase
      .from("orders")
      .update({ estado: "cancelado", rechazado_por: userId, motivo_rechazo: `Depósito no pudo cubrir ningún ítem. ${resumen}` })
      .eq("id", orderId)
      .eq("estado", "borrador");
    await avisar(supabase, userId, {
      user: order.creado_por,
      tipo: "solicitud_rechazada",
      titulo: `Depósito rechazó tu solicitud para ${paciente}`,
      detalle: resumen,
      href: "/pedidos",
      order_id: orderId,
      patient_id: order.patient_id,
    });
    await flash("Rechazaste todos los ítems: la solicitud se cerró y se avisó a quien la pidió.");
    return;
  }

  const autorizado = await tryAutoAuthorize(supabase, orderId, order.patient_id);
  await avisar(supabase, userId, {
    user: order.creado_por,
    tipo: "solicitud_revisada",
    titulo: autorizado ? `Tu solicitud para ${paciente} quedó autorizada` : `Depósito revisó tu solicitud para ${paciente}`,
    detalle: `${resumen}.${autorizado ? " Todo está cubierto por la autorización del paciente: Depósito la prepara." : " Falta la autorización de Administración."}`,
    href: "/pedidos",
    order_id: orderId,
    patient_id: order.patient_id,
  });
  if (!autorizado) {
    await avisar(supabase, userId, {
      rol: "administracion",
      tipo: "pedido_para_autorizar",
      titulo: `Hay un pedido para autorizar: ${paciente}`,
      detalle: "Tiene ítems que no están cubiertos por la autorización estándar del paciente.",
      href: "/pedidos",
      order_id: orderId,
      patient_id: order.patient_id,
    });
  }
  await flash(
    autorizado
      ? "Revisión completa: todo está cubierto por la autorización del paciente, el pedido quedó autorizado."
      : "Revisión completa: se avisó a quien pidió. El pedido espera la autorización de Administración."
  );
}

// ---------------------------------------------------------------------------------------------
// Preparado -> Despachado -> Entregado
// ---------------------------------------------------------------------------------------------

// Depósito junta lo pedido y lo deja listo: estado intermedio «Preparado» (R49).
export async function markPreparedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") return fail("Solo Depósito prepara pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");

  const { data, error } = await supabase
    .from("orders")
    .update({ estado: "preparado", fecha_preparado: new Date().toISOString(), preparado_por: profile.id })
    .eq("id", order_id)
    .eq("estado", "autorizado")
    .select("id, canal_entrega");
  if (error) return fail(`No se pudo marcar el pedido como preparado: ${error.message}`);
  if (!data || data.length === 0) return fail("El pedido tiene que estar autorizado para prepararlo. Actualizá la pantalla.");

  refrescar();
  await flash(
    data[0].canal_entrega === "retiro_local"
      ? "Pedido preparado. Cuando el familiar pase a retirarlo, confirmá el retiro con su firma."
      : "Pedido preparado. Siguiente paso: despacharlo para que Transporte lo entregue."
  );
  return OK;
}

// Depósito despacha: genera el remito digital, avisa a Transporte y deja la tarea en su agenda (§4, paso 4).
export async function dispatchOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito") return fail("Solo Depósito despacha pedidos.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const fecha = String(formData.get("fecha") || "").trim() || hoyAR();
  const hora = String(formData.get("hora") || "").trim() || null;

  const { data: order } = await supabase
    .from("orders")
    .select("id, estado, canal_entrega, prioridad, patient_id, profesional_id, direccion_entrega, patients(nombre_completo, domicilio, telefono_contacto, contacto_familiar_nombre, contacto_familiar_telefono)")
    .eq("id", order_id)
    .single();
  if (!order) return fail("No encontramos el pedido. Actualizá la pantalla.");
  if (order.estado !== "preparado") return fail("Primero marcá el pedido como preparado.");
  if (order.canal_entrega === "retiro_local") {
    return fail("Este pedido es por retiro en el local: no se despacha, se confirma el retiro con la firma del familiar.");
  }

  const { data: moved, error: orderError } = await supabase
    .from("orders")
    .update({ estado: "despachado" })
    .eq("id", order_id)
    .eq("estado", "preparado")
    .select("id");
  if (orderError) return fail(`No se pudo despachar el pedido: ${orderError.message}`);
  if (!moved || moved.length === 0) return fail("El pedido ya no está preparado. Actualizá la pantalla.");

  const err = await crearRemitoSiFalta(supabase, order_id);
  if (err) return fail(err);

  const pac = order.patients as unknown as {
    nombre_completo: string; domicilio: string; telefono_contacto: string | null;
    contacto_familiar_nombre: string | null; contacto_familiar_telefono: string | null;
  } | null;
  const destinatario = pac?.nombre_completo ?? "profesional";
  await supabase.from("transport_tasks").insert({
    tipo: "entrega",
    titulo: `Entregar pedido a ${destinatario}`,
    fecha,
    hora,
    prioridad: order.prioridad === "urgente" ? "alta" : "media",
    order_id,
    patient_id: order.patient_id,
    direccion: pac?.domicilio ?? order.direccion_entrega,
    telefono: pac?.contacto_familiar_telefono ?? pac?.telefono_contacto ?? null,
    contacto: pac?.contacto_familiar_nombre ?? null,
    creado_por: profile.id,
  });

  await avisar(supabase, profile.id, {
    rol: "transporte",
    tipo: "pedido_despachado",
    titulo: `Pedido para entregar: ${destinatario}`,
    detalle: `${order.prioridad === "urgente" ? "URGENTE. " : ""}Está en tu agenda.`,
    href: "/agenda-transporte",
    order_id,
    patient_id: order.patient_id,
  });

  refrescar();
  await flash("Pedido despachado con remito. Transporte lo ve en su agenda para entregarlo.");
  return OK;
}

async function crearRemitoSiFalta(supabase: Sb, orderId: string): Promise<string | null> {
  const { data: existente } = await supabase.from("remitos").select("id").eq("order_id", orderId).limit(1);
  if (existente && existente.length > 0) return null;
  const { error } = await supabase.from("remitos").insert({ order_id: orderId, fecha_despacho: new Date().toISOString() });
  return error ? `El pedido se despachó pero no se pudo generar el remito: ${error.message}` : null;
}

// Entrega y firma del remito por el familiar (§4, pasos 4-5). Al confirmar, los equipos del pedido
// pasan a "asignado" (con foto, estado de condición y ubicación) y queda el movimiento registrado.
//
// DF-C5 §4.3: canal "retiro_local" — el familiar retira en Depósito, sin tarea de Transporte, así
// que quien confirma es Depósito (el pedido pasa por despachado en el mismo acto, para que el
// remito y el descuento de stock queden igual que en una entrega). Canal "domicilio": Transporte.
export async function deliverOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "deposito" && profile.role !== "transporte") return fail("Solo Depósito o Transporte confirman la entrega.");

  const supabase = await createClient();
  const order_id = String(formData.get("order_id") || "");
  const firmante_nombre = String(formData.get("firmante_nombre") || "").trim();
  const firmante_dni = String(formData.get("firmante_dni") || "").replace(/\D/g, "") || null;
  const firmante_vinculo = String(formData.get("firmante_vinculo") || "familiar");
  const firma_png = String(formData.get("firma_png") || "");
  const lat = Number(formData.get("lat") || NaN);
  const lng = Number(formData.get("lng") || NaN);

  const { data: order } = await supabase
    .from("orders")
    .select("id, patient_id, estado, canal_entrega")
    .eq("id", order_id)
    .single();
  if (!order) return fail("No encontramos el pedido. Actualizá la pantalla.");

  const esRetiro = order.canal_entrega === "retiro_local";
  const estadoOk = esRetiro ? order.estado === "preparado" || order.estado === "despachado" : order.estado === "despachado";
  if (!estadoOk) {
    return fail(esRetiro ? "El pedido tiene que estar preparado para confirmar el retiro." : "El pedido tiene que estar despachado para confirmar la entrega.");
  }
  if (esRetiro ? profile.role !== "deposito" : profile.role !== "transporte") {
    return fail(esRetiro ? "Este pedido es por retiro en el local: lo confirma Depósito." : "Este pedido se entrega a domicilio: lo confirma Transporte.");
  }

  if (!firmante_nombre) return fail("Escribí el nombre de quien firma.");
  if (!firma_png.startsWith("data:image/png;base64,") || firma_png.length < 1500) {
    return fail("Falta la firma: pedile a quien recibe que firme en el recuadro y volvé a confirmar.");
  }
  if (firma_png.length > 400_000) return fail("La firma es demasiado pesada. Borrala y firmá de nuevo.");

  const { data: items } = await supabase
    .from("order_items")
    .select("equipment_asset_id, estado_item, equipment_assets(numero_serie)")
    .eq("order_id", order_id)
    .not("equipment_asset_id", "is", null);
  const equipos = (items ?? []).filter((i) => i.estado_item !== "rechazado" && i.equipment_asset_id);

  // Se validan y suben las fotos ANTES de tocar el estado: si algo falla, no queda nada a medias.
  const fotos: { assetId: string; ruta: string; condicion: string }[] = [];
  for (const it of equipos) {
    const assetId = it.equipment_asset_id as string;
    const serie = (it.equipment_assets as unknown as { numero_serie: string } | null)?.numero_serie ?? assetId;
    const cond = String(formData.get(`condicion_${assetId}`) || "");
    const nota = String(formData.get(`nota_${assetId}`) || "").trim();
    const foto = String(formData.get(`foto_${assetId}`) || "");
    if (!cond) return fail(`Indicá el estado del equipo ${serie} al entregarlo.`);
    if (cond === "Con detalles" && !nota) return fail(`Describí el detalle del equipo ${serie}.`);
    if (!esDataUrlImagen(foto)) return fail(`Falta la foto del equipo ${serie}.`);
    try {
      const ruta = await subirFoto(supabase, foto, `entrega/${order_id}`);
      fotos.push({ assetId, ruta, condicion: cond === "Con detalles" ? `Con detalles: ${nota}` : cond });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "No se pudo guardar la foto.");
    }
  }

  const now = new Date().toISOString();

  if (esRetiro && order.estado === "preparado") {
    const { data: moved, error } = await supabase
      .from("orders")
      .update({ estado: "despachado" })
      .eq("id", order_id)
      .eq("estado", "preparado")
      .select("id");
    if (error) return fail(`No se pudo registrar el retiro: ${error.message}`);
    if (!moved || moved.length === 0) return fail("El pedido ya no está preparado. Actualizá la pantalla.");
  }
  const remitoErr = await crearRemitoSiFalta(supabase, order_id);
  if (remitoErr) return fail(remitoErr);

  const { data: remitoUpd, error: remitoError } = await supabase
    .from("remitos")
    .update({
      transportista_id: profile.id,
      fecha_entrega: now,
      // Firma como imagen PNG. Los remitos viejos guardan acá solo el texto del nombre.
      firma_familiar_url: firma_png,
      firmante_nombre,
      firmante_dni,
      firmante_vinculo,
      firmado_at: now,
      entrega_lat: Number.isFinite(lat) ? lat : null,
      entrega_lng: Number.isFinite(lng) ? lng : null,
      // DF-C5 §4.5: notificación al familiar al firmar el remito. Stub — este mockup no tiene
      // integración real de WhatsApp/email conectada; se registra la intención (canal + fecha)
      // para que el desarrollador final la conecte sobre este mismo campo.
      notificacion_enviada_at: now,
      notificacion_canal: "whatsapp+email",
    })
    .eq("order_id", order_id)
    .select("id");
  if (remitoError) return fail(`No se pudo firmar el remito: ${remitoError.message}`);
  if (!remitoUpd || remitoUpd.length === 0) return fail("No se encontró el remito de este pedido. Avisá a Depósito.");

  const { data: entregado, error: estadoError } = await supabase
    .from("orders")
    .update({ estado: "entregado" })
    .eq("id", order_id)
    .eq("estado", "despachado")
    .select("id");
  if (estadoError) return fail(`El remito se firmó pero no se pudo marcar la entrega: ${estadoError.message}`);
  if (!entregado || entregado.length === 0) return fail("El remito se firmó pero el pedido no pasó a entregado: revisá que siga despachado.");

  if (fotos.length > 0 && order.patient_id) {
    const { data: patient } = await supabase.from("patients").select("domicilio").eq("id", order.patient_id).single();
    for (const f of fotos) {
      await supabase.from("equipment_assets").update({ estado: "asignado", notas_condicion: f.condicion }).eq("id", f.assetId);
      await supabase.from("equipment_asset_movements").insert({
        asset_id: f.assetId,
        tipo: "entrega_domicilio",
        patient_id: order.patient_id,
        domicilio_origen: "Depósito",
        domicilio_destino: patient?.domicilio ?? null,
        confirmado_por: profile.id,
        fecha: now,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      });
      await supabase.from("equipment_asset_photos").insert({
        asset_id: f.assetId,
        momento: "entrega",
        url: f.ruta,
        condicion: f.condicion,
        tomada_por: profile.id,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      });
    }
  } else {
    for (const f of fotos) {
      await supabase.from("equipment_assets").update({ estado: "asignado", notas_condicion: f.condicion }).eq("id", f.assetId);
      await supabase.from("equipment_asset_photos").insert({ asset_id: f.assetId, momento: "entrega", url: f.ruta, condicion: f.condicion, tomada_por: profile.id });
    }
  }

  // La tarea de la agenda de Transporte queda cumplida.
  await supabase
    .from("transport_tasks")
    .update({ estado: "completada", completada_at: now, updated_at: now })
    .eq("order_id", order_id)
    .in("estado", ["pendiente", "en_camino"]);

  refrescar();
  await flash("Entrega confirmada y firmada. El remito quedó guardado y se puede imprimir o guardar como PDF desde el pedido.");
  return OK;
}

// ---------------------------------------------------------------------------------------------
// Avisos entre roles (autorizaciones nuevas, solicitudes, despachos).
// ---------------------------------------------------------------------------------------------
export async function markNoticesReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (!["administracion", "coordinador_internacion", "deposito", "transporte"].includes(profile.role)) {
    return fail("Solo Administración, Coordinación, Depósito o Transporte marcan los avisos como leídos.");
  }
  const supabase = await createClient();
  const id = Number(formData.get("notice_id"));
  let q = supabase
    .from("order_notices")
    .update({ leido_at: new Date().toISOString(), leido_por: profile.id })
    .is("leido_at", null);
  if (Number.isFinite(id) && id > 0) q = q.eq("id", id);
  const { error } = await q;
  if (error) return fail(`No se pudo marcar el aviso: ${error.message}`);
  revalidatePath("/pedidos");
  return OK;
}
