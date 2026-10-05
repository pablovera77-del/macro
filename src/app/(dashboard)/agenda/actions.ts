"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { redirect } from "next/navigation";
import type { Enums, TablesUpdate } from "@/types/database";
import { FRANJAS, descripcionHorario, instanteSanJuan, leerHorarioDeForm, type Franja } from "@/lib/horario";
import { cargarPropuestasSemana } from "@/lib/agenda-semana";

function refrescar() {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/productividad");
}

// DF-C2 §4: Coordinación programa la visita (día obligatorio; horario exacto, franja, rango o sin hora).
export async function createVisitAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion"];
  if (!allowed.includes(profile.role)) throw new Error("Solo Coordinación programa visitas.");

  const supabase = await createClient();
  const patient_id = String(formData.get("patient_id") || "");
  const profesional_id = String(formData.get("profesional_id") || "");
  const especialidad = String(formData.get("especialidad") || "") as Enums<"specialty">;
  const observacion_agenda = String(formData.get("observacion_agenda") || "").trim() || null;

  if (!patient_id || !profesional_id || !especialidad) throw new Error("Faltan datos de la visita: elegí el paciente, el profesional y la disciplina.");
  const horario = leerHorarioDeForm(formData);
  if ("error" in horario) throw new Error(horario.error);

  const { data: creada, error } = await supabase
    .from("visits")
    .insert({ patient_id, profesional_id, especialidad, ...horario, observacion_agenda, creado_por: profile.id })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo programar la visita. ${error.message}`);

  // R52: aviso (no bloquea) si el profesional ya tiene otra visita a la misma hora exacta.
  let aviso = "";
  if (!horario.sin_hora && !horario.franja && !horario.hora_desde) {
    const { data: choques } = await supabase
      .from("visits")
      .select("id, patients(nombre_completo)")
      .eq("profesional_id", profesional_id)
      .eq("fecha_programada", horario.fecha_programada)
      .in("estado", ["programada", "confirmada"])
      .neq("id", creada.id);
    if (choques && choques.length > 0) {
      const otro = (choques[0].patients as unknown as { nombre_completo: string } | null)?.nombre_completo ?? "otro paciente";
      aviso = ` Atención: ese profesional ya tiene otra visita a la misma hora (${otro}). Revisá si querés reprogramar una.`;
    }
  }

  refrescar();
  await flash(`Visita programada. El profesional la ve en «Mi agenda».${aviso}`);
  return;
}

// El profesional confirma o marca el resultado de su propia visita (DF-C2 §4).
export async function updateVisitStatusAction(formData: FormData) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  const estado = String(formData.get("estado") || "") as Enums<"visit_status">;
  if (!visit_id || !estado) throw new Error("Faltan datos.");

  // Solo el profesional de la visita o Coordinación pueden cambiar su estado.
  if (profile.role !== "coordinador_internacion" && profile.role !== "profesional_asistencial") {
    throw new Error("Solo el profesional asistencial de la visita o Coordinación cambian su estado.");
  }
  if (profile.role === "profesional_asistencial") {
    const { data: visita } = await supabase.from("visits").select("profesional_id").eq("id", visit_id).maybeSingle();
    if (!visita || visita.profesional_id !== profile.id) throw new Error("Solo el profesional asignado a la visita puede cambiar su estado.");
    if (estado === "cancelada") throw new Error("Solo Coordinación cancela visitas.");
  }

  const patch: TablesUpdate<"visits"> = { estado };
  const ahora = new Date().toISOString();
  if (estado === "realizada") patch.fecha_realizada = ahora;
  // R13: hora de cierre como dato interno (la apertura la marca «Iniciar visita»).
  if (estado === "realizada" || estado === "no_realizada") patch.cerrada_at = ahora;

  const { error } = await supabase.from("visits").update(patch).eq("id", visit_id);
  if (error) throw new Error(error.message);

  refrescar();
  revalidatePath("/evoluciones");
  // Cierre de visita: al marcarla realizada se lleva al profesional directo a
  // cargar su evolución (antes tenía que ir a buscarla a otra pantalla).
  if (estado === "realizada") redirect(`/evoluciones?visita=${visit_id}`);
  if (estado === "no_realizada") await flash("Visita marcada como no realizada. Coordinación la va a ver para reprogramarla.");
  return;
}

// R12: el profesional avisa que llegó al domicilio. La ubicación es opcional (si el celular no la da, se inicia igual).
export async function iniciarVisitaAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") throw new Error("Solo el profesional asistencial de la visita inicia la visita.");
  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  if (!visit_id) throw new Error("Falta indicar la visita.");

  const { data: visita } = await supabase.from("visits").select("profesional_id, estado, abierta_at").eq("id", visit_id).maybeSingle();
  if (!visita || visita.profesional_id !== profile.id) throw new Error("Solo el profesional asignado a la visita puede iniciarla.");
  if (visita.estado !== "programada" && visita.estado !== "confirmada") throw new Error("Esa visita ya está cerrada o cancelada: no se puede iniciar.");
  if (visita.abierta_at) {
    await flash("Esa visita ya estaba iniciada. Cuando termines, tocá «Realizada».");
    return;
  }

  const num = (k: string, max: number) => {
    const raw = String(formData.get(k) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
  };
  const lat = num("lat", 90);
  const lng = num("lng", 180);

  const { error } = await supabase
    .from("visits")
    .update({ abierta_at: new Date().toISOString(), abierta_lat: lat !== null && lng !== null ? lat : null, abierta_lng: lat !== null && lng !== null ? lng : null })
    .eq("id", visit_id);
  if (error) throw new Error(`No se pudo iniciar la visita. ${error.message}`);

  refrescar();
  await flash("Visita iniciada. Cuando termines, tocá «Realizada» y cargá la evolución.");
  return;
}

// E4: Coordinación reprograma una visita atrasada sin tener que cancelarla y volver a crearla.
export async function rescheduleVisitAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion"];
  if (!allowed.includes(profile.role)) throw new Error("Solo Coordinación reprograma visitas.");
  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  if (!visit_id) throw new Error("Falta indicar la visita.");
  const horario = leerHorarioDeForm(formData);
  if ("error" in horario) throw new Error(horario.error);
  const { error } = await supabase
    .from("visits")
    .update({ ...horario, estado: "programada", abierta_at: null, abierta_lat: null, abierta_lng: null, recordatorio_enviado_at: null })
    .eq("id", visit_id);
  if (error) throw new Error(error.message);
  refrescar();
  await flash("Visita reprogramada. El profesional la ve con la nueva fecha en «Mi agenda».");
  return;
}

export async function cancelVisitAction(formData: FormData) {
  const { profile } = await requireProfile();
  const allowed: Enums<"app_role">[] = ["coordinador_internacion"];
  if (!allowed.includes(profile.role)) throw new Error("Solo Coordinación cancela visitas.");

  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  const { error } = await supabase.from("visits").update({ estado: "cancelada" }).eq("id", visit_id);
  if (error) throw new Error(error.message);
  refrescar();
  await flash("Visita cancelada.");
  return;
}

// G4: los recordatorios se mandan a mano por WhatsApp; acá Coordinación deja anotado cuáles ya salieron.
export async function marcarRecordatorioEnviadoAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "coordinador_internacion") throw new Error("Solo Coordinación marca los recordatorios como enviados.");
  const supabase = await createClient();
  const visit_id = String(formData.get("visit_id") || "");
  if (!visit_id) throw new Error("Falta indicar la visita.");
  const deshacer = String(formData.get("deshacer") || "") === "1";
  const { error } = await supabase.from("visits").update({ recordatorio_enviado_at: deshacer ? null : new Date().toISOString() }).eq("id", visit_id);
  if (error) throw new Error(`No se pudo registrar el recordatorio. ${error.message}`);
  refrescar();
  return;
}

// Agenda recurrente: crea las visitas elegidas en la vista previa. Las propuestas se vuelven a
// calcular acá con los datos de ahora, así que lo que ya se programó mientras tanto no se duplica.
export async function generarVisitasSemanaAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "coordinador_internacion") throw new Error("Solo Coordinación genera las visitas de la semana.");
  const supabase = await createClient();

  const elegidas = new Set(formData.getAll("item").map(String));
  if (elegidas.size === 0) throw new Error("No marcaste ninguna visita para crear. Tildá al menos una en la vista previa.");
  const modo = String(formData.get("horario_lote") || "sin_hora");
  if (modo !== "sin_hora" && !(modo in FRANJAS)) throw new Error("Elegí si las visitas van sin hora o en mañana, tarde o noche.");

  const { propuestas } = await cargarPropuestasSemana();
  const aCrear = propuestas.filter((p) => elegidas.has(p.key) && p.profesional_id);
  const omitidas = elegidas.size - aCrear.length;
  if (aCrear.length === 0) {
    await flash("No se creó ninguna visita: ya estaban programadas o el paciente no tiene profesional asignado en esa disciplina.");
    refrescar();
    return;
  }

  const filas = aCrear.map((p) => {
    const franja = modo === "sin_hora" ? null : (modo as Franja);
    return {
      patient_id: p.patient_id,
      profesional_id: p.profesional_id as string,
      especialidad: p.especialidad as Enums<"specialty">,
      fecha_programada: instanteSanJuan(p.ymd, franja ? FRANJAS[franja].desde : "00:00").toISOString(),
      sin_hora: modo === "sin_hora",
      franja,
      observacion_agenda: "Generada desde el plan de tratamiento",
      creado_por: profile.id,
    };
  });
  const { error } = await supabase.from("visits").insert(filas);
  if (error) throw new Error(`No se pudieron crear las visitas. ${error.message}`);

  refrescar();
  const horarioTxt = modo === "sin_hora" ? "sin hora definida" : descripcionHorario({ fecha_programada: filas[0].fecha_programada, franja: modo });
  await flash(
    `Se crearon ${filas.length} ${filas.length === 1 ? "visita" : "visitas"} (${horarioTxt}).${omitidas > 0 ? ` ${omitidas} no se crearon porque ya estaban programadas o no tienen profesional.` : ""} Podés ajustar el horario de cada una desde la agenda.`
  );
  return;
}
