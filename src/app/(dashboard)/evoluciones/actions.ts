"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import type { Enums, Json } from "@/types/database";
import {
  campoKey,
  NOVA5_DIMENSIONES,
  parseCampos,
  riesgoNova5,
  SIGNATURE_MAX_LENGTH,
  SIGNATURE_PREFIX,
  type MedicacionItem,
  type Nova5,
} from "@/lib/hc";

export type EvolucionResult = { error?: string };

const texto = (v: FormDataEntryValue | null, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function coord(v: FormDataEntryValue | null, limite: number): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limite ? n : null;
}

function firmaValida(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string" || !v.startsWith(SIGNATURE_PREFIX) || v.length > SIGNATURE_MAX_LENGTH || v.length < SIGNATURE_PREFIX.length + 200) return null;
  return v;
}

// DF-C2 §5: registro de evolución clínica, motor de formulario dinámico por disciplina
// (operacionaliza el activo del sistema viejo — informe-tecnico §3.2 — con las definiciones
// clínicas reales de DF-C2). Todo se valida acá, en el servidor (R31): campos obligatorios de
// la plantilla, firma del profesional (con nombre y matrícula, R16) y conformidad de la familia
// (R17). Devuelve un mensaje en castellano si algo falta; el formulario lo muestra sin perder lo cargado.
// DF-C2 §5.4: si la disciplina es enfermería y se completan las 5 dimensiones de la Escala Nova 5,
// calculamos el riesgo de UPP automáticamente.
export async function createEvolutionAction(formData: FormData): Promise<EvolucionResult> {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") return { error: "Solo el profesional asistencial carga evoluciones." };

  const supabase = await createClient();
  const visit_id = texto(formData.get("visit_id"), 60);
  const patient_id = texto(formData.get("patient_id"), 60);
  const especialidad = texto(formData.get("especialidad"), 40) as Enums<"specialty">;
  if (!visit_id || !patient_id || !especialidad) return { error: "Faltan datos de la visita. Volvé a abrir la visita pendiente e intentá de nuevo." };

  // La visita tiene que ser de este profesional, estar realizada y no tener evolución todavía.
  const { data: visita } = await supabase.from("visits").select("id, patient_id, profesional_id, especialidad, estado").eq("id", visit_id).maybeSingle();
  if (!visita || visita.patient_id !== patient_id || visita.especialidad !== especialidad) return { error: "No encontramos esa visita. Actualizá la pantalla e intentá de nuevo." };
  if (visita.profesional_id !== profile.id) return { error: "Esa visita está asignada a otro profesional. Solo quien la realizó carga su evolución." };
  if (visita.estado !== "realizada") return { error: "Primero marcá la visita como realizada y después cargá la evolución." };
  const { data: yaCargada } = await supabase.from("evolutions").select("id").eq("visit_id", visit_id).maybeSingle();
  if (yaCargada) return { error: "Esta visita ya tiene su evolución cargada. Actualizá la pantalla." };

  // Plantilla vigente de la disciplina: se lee del servidor, no se confía en lo que manda el navegador.
  const { data: template } = await supabase.from("discipline_form_templates").select("id, campos").eq("especialidad", especialidad).eq("activo", true).limit(1).maybeSingle();
  const campos = parseCampos(template?.campos);

  const respuestas: Record<string, string> = {};
  for (const c of campos) {
    const key = campoKey(c);
    const valor = texto(formData.get(`campo__${key}`));
    if (!valor) {
      if (c.obligatorio) return { error: `Falta completar «${c.label}».` };
      continue;
    }
    if (c.tipo === "Sí/No" && valor !== "Sí" && valor !== "No") return { error: `En «${c.label}» elegí Sí o No.` };
    if (c.tipo === "Selección" && !(c.opciones ?? []).includes(valor)) return { error: `En «${c.label}» elegí una de las opciones de la lista.` };
    if ((c.tipo === "Número" || c.tipo === "Año") && !Number.isFinite(Number(valor))) return { error: `«${c.label}» tiene que ser un número.` };
    respuestas[key] = valor;
  }

  // Escala Nova 5: "No aplica" (vacío) en las cinco = no se registra. Si completa algunas, tienen que ser las cinco.
  let upp_escala_nova5: Nova5 | null = null;
  if (especialidad === "enfermeria") {
    const valores = NOVA5_DIMENSIONES.map((d) => texto(formData.get(`nova5__${d.key}`), 2));
    const cargadas = valores.filter((v) => v !== "");
    if (cargadas.length > 0 && cargadas.length < NOVA5_DIMENSIONES.length) {
      return { error: "En la escala de riesgo de úlceras (Nova 5) completá las cinco preguntas, o dejá todas en «No aplica»." };
    }
    if (cargadas.length === NOVA5_DIMENSIONES.length) {
      const nums = valores.map((v) => Number(v));
      if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 3)) return { error: "Los puntajes de la escala Nova 5 van de 0 a 3." };
      const total = nums.reduce((a, b) => a + b, 0);
      const riesgo = riesgoNova5(total);
      // Con todo en 0 se interpreta «sin riesgo» y no se registra un puntaje.
      if (riesgo) {
        upp_escala_nova5 = {
          estado_mental: nums[0],
          incontinencia: nums[1],
          movilidad: nums[2],
          nutricion: nums[3],
          actividad: nums[4],
          total,
          riesgo,
          ...(formData.get("nova5__movilizacion") === "on" ? { movilizacion_indicada: true } : {}),
        };
      }
    }
  }

  // Medicina: medicación estructurada y alerta de cambio relevante (R34-R36).
  let medicacion: MedicacionItem[] | null = null;
  let alerta_cambio = false;
  let alerta_motivo: string | null = null;
  if (especialidad === "medicina") {
    try {
      const crudo = JSON.parse(texto(formData.get("medicacion"), 20000) || "[]") as Partial<MedicacionItem>[];
      const filas = (Array.isArray(crudo) ? crudo : []).slice(0, 30).map((m) => ({
        cantidad: texto(m.cantidad ?? "", 60),
        droga: texto(m.droga ?? "", 200),
        nombre_comercial: texto(m.nombre_comercial ?? "", 200),
        dosis: texto(m.dosis ?? "", 120),
        frecuencia: texto(m.frecuencia ?? "", 120),
      }));
      const conDatos = filas.filter((m) => Object.values(m).some((v) => v !== ""));
      if (conDatos.some((m) => !m.droga)) return { error: "En la medicación, cada renglón necesita al menos la droga. Completala o quitá el renglón vacío." };
      medicacion = conDatos.length > 0 ? conDatos : null;
    } catch {
      return { error: "No pudimos leer la medicación cargada. Revisá los renglones e intentá de nuevo." };
    }
    if (formData.get("alerta_cambio") === "on") {
      alerta_motivo = texto(formData.get("alerta_motivo"), 600);
      if (!alerta_motivo) return { error: "Contanos qué cambió en la medicación o en la indicación, para avisarle al equipo." };
      alerta_cambio = true;
    }
  }

  // Firmas (R16, R17, R06): las dos son obligatorias.
  const matricula = texto(formData.get("matricula"), 60);
  if (!matricula) return { error: "Completá tu matrícula: va impresa junto a tu firma." };
  const firma_profesional_img = firmaValida(formData.get("firma_profesional_img"));
  if (!firma_profesional_img) return { error: "Falta tu firma. Dibujala en el recuadro «Firma del profesional»." };
  const conformidad_nombre = texto(formData.get("conformidad_nombre"), 120);
  if (!conformidad_nombre) return { error: "Escribí el nombre de quien firma por el paciente o la familia." };
  const conformidad_firma = firmaValida(formData.get("conformidad_img"));
  if (!conformidad_firma) return { error: "Falta la firma de conformidad del paciente o familiar. Pedile que la dibuje en el recuadro." };

  // La matrícula queda guardada en el perfil para las próximas evoluciones.
  const { data: perfil } = await supabase.from("profiles").select("matricula").eq("id", profile.id).maybeSingle();
  if (perfil?.matricula !== matricula) {
    const { error: eMat } = await supabase.from("profiles").update({ matricula }).eq("id", profile.id);
    if (eMat) return { error: "No pudimos guardar tu matrícula. Probá de nuevo en unos minutos." };
  }

  const ahora = new Date().toISOString();
  const { error } = await supabase.from("evolutions").insert({
    visit_id,
    patient_id,
    profesional_id: profile.id,
    especialidad,
    template_id: template?.id ?? null,
    respuestas,
    upp_escala_nova5: upp_escala_nova5 as unknown as Json,
    medicacion: medicacion as unknown as Json,
    alerta_cambio,
    alerta_motivo,
    firma_profesional_at: ahora,
    firma_profesional_img,
    firma_profesional_nombre: profile.full_name,
    firma_profesional_matricula: matricula,
    firma_lat: coord(formData.get("firma_profesional_lat"), 90),
    firma_lng: coord(formData.get("firma_profesional_lng"), 180),
    conformidad_familiar: true,
    conformidad_familiar_at: ahora,
    conformidad_nombre,
    conformidad_firma,
    conformidad_lat: coord(formData.get("conformidad_lat"), 90),
    conformidad_lng: coord(formData.get("conformidad_lng"), 180),
  });

  if (error) {
    if (error.code === "23505") return { error: "Esta visita ya tiene su evolución cargada. Actualizá la pantalla." };
    return { error: "No pudimos guardar la evolución. Revisá la conexión e intentá de nuevo; lo que cargaste sigue en pantalla." };
  }
  revalidatePath("/evoluciones");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  await flash(
    alerta_cambio
      ? "Evolución guardada y firmada. Avisamos al equipo del paciente del cambio de medicación."
      : "Evolución guardada y firmada. La visita quedó cerrada."
  );
  return {};
}

// DF-C2 §9 (R74): una evolución firmada no se edita; se corrige con una nota aclaratoria que
// queda al lado del original, con autor y fecha.
export async function addEvolutionNoteAction(formData: FormData): Promise<EvolucionResult> {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial" && profile.role !== "coordinador_internacion") {
    return { error: "Solo el profesional asistencial de la evolución o Coordinación agregan notas aclaratorias." };
  }
  const supabase = await createClient();
  const evolution_id = texto(formData.get("evolution_id"), 60);
  const nota = texto(formData.get("texto"), 4000);
  if (!evolution_id) return { error: "Faltan datos de la evolución. Actualizá la pantalla e intentá de nuevo." };
  if (!nota) return { error: "Escribí la aclaración antes de guardarla." };

  const { data: evo } = await supabase.from("evolutions").select("id, profesional_id").eq("id", evolution_id).maybeSingle();
  if (!evo) return { error: "No encontramos esa evolución. Actualizá la pantalla e intentá de nuevo." };
  if (profile.role === "profesional_asistencial" && evo.profesional_id !== profile.id) {
    return { error: "Solo quien cargó la evolución (o Coordinación) puede agregarle una nota aclaratoria." };
  }

  const { error } = await supabase.from("evolution_notes").insert({ evolution_id, texto: nota });
  if (error) return { error: "No pudimos guardar la nota aclaratoria. Probá de nuevo en unos minutos." };
  revalidatePath("/evoluciones");
  revalidatePath("/paciente/[id]", "page");
  await flash("Nota aclaratoria guardada. Queda junto a la evolución original, que no se modifica.");
  return {};
}
