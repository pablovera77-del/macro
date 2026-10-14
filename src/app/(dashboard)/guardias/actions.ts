"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { ROLES_GUARDIAS, FECHA_RE, HORA_RE, TRAMOS, fechasConsecutivas, fechasPorTramo, sabadoDesde, sabadoSiguiente } from "@/lib/guardias";

export type GuardiaState = { error: string } | null;

// H12: asigna guardias por tramos de la semana o por día y cantidad, sin cargar visita por visita.
export async function programarGuardiasAction(_prev: GuardiaState, formData: FormData): Promise<GuardiaState> {
  const { profile } = await requireProfile();
  if (!ROLES_GUARDIAS.includes(profile.role)) return { error: "Solo Coordinación y Administración arman las guardias." };

  const patient_id = String(formData.get("patient_id") || "");
  const profesional_id = String(formData.get("profesional_id") || "") || null;
  const modo = String(formData.get("modo") || "tramo");
  const desde = String(formData.get("desde") || "");
  const hasta = String(formData.get("hasta") || "");
  const hora_desde = String(formData.get("hora_desde") || "08:00");
  const hora_hasta = String(formData.get("hora_hasta") || "20:00");
  const nota = String(formData.get("nota") || "").trim().slice(0, 500) || null;
  if (!patient_id) return { error: "Elegí el paciente." };
  if (!FECHA_RE.test(desde)) return { error: "Falta la fecha de inicio." };
  if (!HORA_RE.test(hora_desde) || !HORA_RE.test(hora_hasta) || hora_desde === hora_hasta) return { error: "Revisá el horario de la guardia." };

  let fechas: string[];
  if (modo === "cantidad") {
    const n = Number(formData.get("cantidad") || 0);
    if (!Number.isInteger(n) || n < 1 || n > 62) return { error: "La cantidad de días tiene que ser entre 1 y 62." };
    fechas = fechasConsecutivas(desde, n);
  } else {
    if (!FECHA_RE.test(hasta) || hasta < desde) return { error: "La fecha final tiene que ser igual o posterior al inicio." };
    const tramo = TRAMOS[String(formData.get("tramo") || "")];
    if (!tramo) return { error: "Elegí el tramo de la semana." };
    fechas = fechasPorTramo(desde, hasta, tramo.dias);
    if (fechas.length === 0) return { error: "Ese rango no tiene días del tramo elegido." };
  }

  const supabase = await createClient();
  // Evita duplicar guardias ya cargadas para el mismo paciente, día, hora y profesional.
  const { data: existentes } = await supabase
    .from("guardias_programadas")
    .select("fecha, desde, profesional_id")
    .eq("patient_id", patient_id)
    .gte("fecha", fechas[0])
    .lte("fecha", fechas[fechas.length - 1]);
  const ya = new Set((existentes ?? []).map((e) => `${e.fecha}|${e.desde.slice(0, 5)}|${e.profesional_id ?? ""}`));
  const nuevas = fechas.filter((f) => !ya.has(`${f}|${hora_desde}|${profesional_id ?? ""}`));
  if (nuevas.length === 0) return { error: "Esas guardias ya estaban cargadas." };

  const { error } = await supabase.from("guardias_programadas").insert(
    nuevas.map((fecha) => ({ patient_id, profesional_id, fecha, desde: hora_desde, hasta: hora_hasta, nota }))
  );
  if (error) return { error: `No se pudieron guardar las guardias: ${error.message}` };
  revalidatePath("/guardias");
  revalidatePath("/inicio");
  await flash(`${nuevas.length} guardia(s) cargada(s)${nuevas.length < fechas.length ? ` (${fechas.length - nuevas.length} ya estaban)` : ""}.`);
  return null;
}

// Pone o cambia el profesional de una guardia que estaba sin cubrir.
export async function asignarProfesionalGuardiaAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ROLES_GUARDIAS.includes(profile.role)) throw new Error("Solo Coordinación y Administración arman las guardias.");
  const id = String(formData.get("id") || "");
  const profesional_id = String(formData.get("profesional_id") || "");
  if (!id || !profesional_id) throw new Error("Elegí un profesional.");
  const supabase = await createClient();
  const { error } = await supabase.from("guardias_programadas").update({ profesional_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/guardias");
  revalidatePath("/inicio");
  await flash("Profesional asignado a la guardia.");
}

export async function quitarGuardiaAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ROLES_GUARDIAS.includes(profile.role)) throw new Error("Solo Coordinación y Administración arman las guardias.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Falta la guardia.");
  const supabase = await createClient();
  const { error } = await supabase.from("guardias_programadas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/guardias");
  revalidatePath("/inicio");
  await flash("Guardia quitada.");
}

// Guardia de kinesiología de fin de semana: quien la cubre ve a todos los pacientes de kinesiología de lunes a lunes.
export async function programarGuardiaKineAction(_prev: GuardiaState, formData: FormData): Promise<GuardiaState> {
  const { profile } = await requireProfile();
  if (!ROLES_GUARDIAS.includes(profile.role)) return { error: "Solo Coordinación y Administración arman las guardias." };
  const fecha = String(formData.get("fecha") || "");
  const profesional_id = String(formData.get("profesional_id") || "");
  const cantidad = Math.floor(Number(formData.get("cantidad") || 1));
  const nota = String(formData.get("nota") || "").trim().slice(0, 500) || null;
  if (!FECHA_RE.test(fecha)) return { error: "Elegí la fecha del fin de semana." };
  if (!profesional_id) return { error: "Elegí al profesional que cubre la guardia." };
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 8) return { error: "La cantidad de fines de semana tiene que ser entre 1 y 8." };

  const supabase = await createClient();
  const primero = sabadoDesde(fecha);
  const sabados = Array.from({ length: cantidad }, (_, i) => sabadoSiguiente(primero, i));
  const { data: existentes } = await supabase.from("guardias_kine_fin_de_semana").select("sabado").eq("profesional_id", profesional_id).in("sabado", sabados);
  const ya = new Set((existentes ?? []).map((e) => e.sabado));
  const nuevos = sabados.filter((s) => !ya.has(s));
  if (nuevos.length === 0) return { error: "Esa guardia ya estaba cargada." };
  const { error } = await supabase.from("guardias_kine_fin_de_semana").insert(nuevos.map((sabado) => ({ sabado, profesional_id, nota, created_by: profile.id })));
  if (error) return { error: `No se pudo guardar la guardia: ${error.message}` };
  revalidatePath("/guardias");
  revalidatePath("/guardias/turno");
  revalidatePath("/inicio");
  await flash(`${nuevos.length} guardia(s) de kinesiología de fin de semana cargada(s).`);
  return null;
}

export async function quitarGuardiaKineAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!ROLES_GUARDIAS.includes(profile.role)) throw new Error("Solo Coordinación y Administración arman las guardias.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Falta la guardia.");
  const supabase = await createClient();
  const { error } = await supabase.from("guardias_kine_fin_de_semana").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/guardias");
  revalidatePath("/guardias/turno");
  revalidatePath("/inicio");
  await flash("Guardia de kinesiología quitada.");
}
