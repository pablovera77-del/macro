"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { flash } from "@/lib/flash";
import { avisar } from "@/lib/order-notices";
import { hoyAR } from "@/lib/plan";
import { seSuperponen, sumarDias, horaCorta } from "@/lib/agenda-transporte";
import type { ActionState } from "@/lib/stock-types";

const OK: ActionState = { error: null };
const fail = (error: string): ActionState => ({ error });
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

function refrescar() {
  revalidatePath("/agenda-transporte");
  revalidatePath("/pedidos");
  revalidatePath("/inicio");
}

type Sb = Awaited<ReturnType<typeof createClient>>;

// Busca otra tarea del mismo día que se pise con el horario pedido (R62: aviso de conflicto).
async function conflicto(supabase: Sb, fecha: string, hora: string | null, duracion: number, excluirId?: string) {
  if (!hora) return null;
  const { data } = await supabase
    .from("transport_tasks")
    .select("id, titulo, hora, duracion_min")
    .eq("fecha", fecha)
    .in("estado", ["pendiente", "en_camino"])
    .not("hora", "is", null);
  return (data ?? []).find((t) => t.id !== excluirId && seSuperponen({ hora, duracion_min: duracion }, t)) ?? null;
}

// Transporte, Depósito o Administración (H17, Vanina 06/10) agendan una tarea de cadetería, única o programada.
export async function crearTareaTransporteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte" && profile.role !== "deposito" && profile.role !== "administracion") return fail("Solo Transporte, Depósito o Administración crean tareas en la agenda de Transporte.");
  const supabase = await createClient();

  const titulo = String(formData.get("titulo") || "").trim();
  const fecha = String(formData.get("fecha") || "") || hoyAR();
  const hora = String(formData.get("hora") || "").trim() || null;
  const duracion = Math.max(5, Math.floor(Number(formData.get("duracion_min") || 30)) || 30);
  const prioridad = String(formData.get("prioridad") || "media");
  const permanente = formData.get("permanente") === "on";
  const repeticion = permanente ? String(formData.get("repeticion") || "diaria") : null;
  const dias = formData.getAll("dias_semana").map(Number).filter((n) => n >= 1 && n <= 7);
  const tipo = String(formData.get("tipo") || "otro");

  if (!titulo) return fail("Escribí qué hay que hacer (por ejemplo «Llevar el equipo a service»).");
  if (!FECHA.test(fecha)) return fail("La fecha no es válida.");
  if (hora && !HORA.test(hora)) return fail("La hora no es válida.");
  if (!["alta", "media", "baja"].includes(prioridad)) return fail("Elegí la prioridad: alta, media o baja.");
  if (!["entrega", "retiro", "otro"].includes(tipo)) return fail("Elegí el tipo de tarea.");
  if (permanente && !["diaria", "semanal", "mensual"].includes(repeticion ?? "")) return fail("Elegí cada cuánto se repite la tarea.");

  if (formData.get("guardar_igual") !== "on") {
    const c = await conflicto(supabase, fecha, hora, duracion);
    if (c) return fail(`Ya hay una tarea a esa hora: «${c.titulo}» (${horaCorta(c.hora)}). Cambiá el horario o marcá «Guardar igual» para que queden juntas.`);
  }

  const { error } = await supabase.from("transport_tasks").insert({
    tipo,
    titulo,
    descripcion: String(formData.get("descripcion") || "").trim() || null,
    fecha,
    hora,
    duracion_min: duracion,
    prioridad,
    permanente,
    repeticion,
    dias_semana: permanente && repeticion === "semanal" && dias.length > 0 ? dias : null,
    direccion: String(formData.get("direccion") || "").trim() || null,
    telefono: String(formData.get("telefono") || "").trim() || null,
    contacto: String(formData.get("contacto") || "").trim() || null,
    creado_por: profile.id,
  });
  if (error) return fail(`No se pudo guardar la tarea: ${error.message}`);
  refrescar();
  await flash("Tarea agendada. Transporte la ve en su agenda; Depósito, Facturación y Dirección también.");
  return OK;
}

// Transporte sale hacia el domicilio: queda la hora de inicio y el aviso «en camino» al familiar (pendiente de conectar).
export async function iniciarTareaTransporteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte") return fail("Solo Transporte inicia y completa las tareas de la agenda.");
  const supabase = await createClient();
  const id = String(formData.get("task_id") || "");
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("transport_tasks")
    .update({ estado: "en_camino", iniciada_at: ahora, aviso_en_camino_at: ahora, updated_at: ahora })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return fail(`No se pudo iniciar la tarea: ${error.message}`);
  if (!data || data.length === 0) return fail("La tarea ya no está pendiente. Actualizá la pantalla.");
  refrescar();
  await flash("Tarea iniciada. Queda registrada la hora de salida y el aviso «en camino» al familiar.");
  return OK;
}

// Cierra una tarea propia (las entregas y retiros se cierran al firmar el remito).
export async function completarTareaTransporteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte") return fail("Solo Transporte inicia y completa las tareas de la agenda.");
  const supabase = await createClient();
  const id = String(formData.get("task_id") || "");
  const fecha = String(formData.get("fecha") || "") || hoyAR();
  const nota = String(formData.get("nota") || "").trim() || null;

  const { data: t } = await supabase.from("transport_tasks").select("id, order_id, permanente, estado").eq("id", id).single();
  if (!t) return fail("No encontramos la tarea. Actualizá la pantalla.");
  if (t.order_id) return fail("Esta tarea es la entrega de un pedido: se completa al confirmar la entrega con la firma, desde Pedidos.");
  const ahora = new Date().toISOString();

  if (t.permanente) {
    const { error } = await supabase
      .from("transport_task_runs")
      .upsert({ task_id: id, fecha, completada_por: profile.id, completada_at: ahora, nota }, { onConflict: "task_id,fecha" });
    if (error) return fail(`No se pudo marcar la tarea: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("transport_tasks")
      .update({ estado: "completada", completada_at: ahora, updated_at: ahora })
      .eq("id", id)
      .in("estado", ["pendiente", "en_camino"])
      .select("id");
    if (error) return fail(`No se pudo completar la tarea: ${error.message}`);
    if (!data || data.length === 0) return fail("La tarea ya estaba cerrada. Actualizá la pantalla.");
  }
  refrescar();
  await flash("Tarea completada. Quedó registrada con la hora.");
  return OK;
}

// «No se pudo hacer hoy»: pasa sola al día siguiente con la nota del motivo (R62).
export async function reprogramarTareaTransporteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte" && profile.role !== "deposito" && profile.role !== "administracion") return fail("Solo Transporte, Depósito o Administración editan y reprograman las tareas.");
  const supabase = await createClient();
  const id = String(formData.get("task_id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!motivo) return fail("Contá por qué no se pudo hacer (por ejemplo «no había nadie en la casa»): la nota queda en la tarea.");

  const { data: t } = await supabase
    .from("transport_tasks")
    .select("id, titulo, fecha, estado, permanente, reprogramaciones, order_id, patient_id")
    .eq("id", id)
    .single();
  if (!t) return fail("No encontramos la tarea. Actualizá la pantalla.");
  if (t.permanente) return fail("Las tareas permanentes no se reprograman: se repiten solas todos los días que corresponden.");
  if (!["pendiente", "en_camino"].includes(t.estado)) return fail("Esa tarea ya está cerrada.");

  const base = t.fecha < hoyAR() ? hoyAR() : t.fecha;
  const nueva = sumarDias(base, 1);
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("transport_tasks")
    .update({
      fecha: nueva,
      estado: "pendiente",
      iniciada_at: null,
      reprogramada_desde: t.fecha,
      reprogramaciones: (t.reprogramaciones ?? 0) + 1,
      nota_reprogramacion: motivo,
      updated_at: ahora,
    })
    .eq("id", id);
  if (error) return fail(`No se pudo reprogramar la tarea: ${error.message}`);
  await avisar(supabase, profile.id, {
    rol: profile.role === "transporte" ? "deposito" : "transporte",
    tipo: "tarea_reprogramada",
    titulo: `Tarea reprogramada: ${t.titulo}`,
    detalle: motivo,
    href: "/agenda-transporte",
    order_id: t.order_id,
    patient_id: t.patient_id,
  });
  refrescar();
  await flash("La tarea pasó al día siguiente con la nota del motivo.");
  return OK;
}

// Depósito (o Transporte) cambia fecha, hora o prioridad; avisa si se pisa con otra tarea.
export async function editarTareaTransporteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte" && profile.role !== "deposito" && profile.role !== "administracion") return fail("Solo Transporte, Depósito o Administración editan y reprograman las tareas.");
  const supabase = await createClient();
  const id = String(formData.get("task_id") || "");
  const fecha = String(formData.get("fecha") || "");
  const hora = String(formData.get("hora") || "").trim() || null;
  const prioridad = String(formData.get("prioridad") || "media");
  if (!FECHA.test(fecha)) return fail("Elegí una fecha válida.");
  if (hora && !HORA.test(hora)) return fail("La hora no es válida.");
  if (!["alta", "media", "baja"].includes(prioridad)) return fail("Elegí la prioridad: alta, media o baja.");

  const { data: t } = await supabase.from("transport_tasks").select("id, duracion_min, estado").eq("id", id).single();
  if (!t) return fail("No encontramos la tarea. Actualizá la pantalla.");
  if (!["pendiente", "en_camino"].includes(t.estado)) return fail("Esa tarea ya está cerrada.");
  if (formData.get("guardar_igual") !== "on") {
    const c = await conflicto(supabase, fecha, hora, t.duracion_min, id);
    if (c) return fail(`Ya hay una tarea a esa hora: «${c.titulo}» (${horaCorta(c.hora)}). Cambiá el horario o marcá «Guardar igual».`);
  }
  const { error } = await supabase
    .from("transport_tasks")
    .update({ fecha, hora, prioridad, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(`No se pudo guardar el cambio: ${error.message}`);
  refrescar();
  await flash("Cambio guardado en la agenda.");
  return OK;
}

export async function cancelarTareaTransporteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "transporte" && profile.role !== "deposito" && profile.role !== "administracion") return fail("Solo Transporte, Depósito o Administración editan y reprograman las tareas.");
  const supabase = await createClient();
  const id = String(formData.get("task_id") || "");
  const { data: t } = await supabase.from("transport_tasks").select("order_id").eq("id", id).single();
  if (t?.order_id) return fail("Esta tarea viene de un pedido: no se cancela desde la agenda.");
  const { error } = await supabase.from("transport_tasks").update({ estado: "cancelada", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(`No se pudo cancelar la tarea: ${error.message}`);
  refrescar();
  await flash("Tarea cancelada.");
  return OK;
}
