"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { hoyAR } from "@/lib/plan";
import { SIGNATURE_MAX_LENGTH, SIGNATURE_PREFIX } from "@/lib/hc";

export type TurnoState = { error: string | null; ok?: boolean };

const fail = (error: string): TurnoState => ({ error });
const texto = (v: FormDataEntryValue | null, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function firmaValida(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string" || !v.startsWith(SIGNATURE_PREFIX) || v.length > SIGNATURE_MAX_LENGTH || v.length < SIGNATURE_PREFIX.length + 200) return null;
  return v;
}

function numero(v: FormDataEntryValue | null, min: number, max: number): number | null | "mal" {
  const t = texto(v, 20);
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : "mal";
}

const siNo = (v: FormDataEntryValue | null): boolean | null => (v === "Sí" ? true : v === "No" ? false : null);

function refrescar() {
  revalidatePath("/guardias/turno");
  revalidatePath("/guardias");
  revalidatePath("/inicio");
}

// Formulario de guardia (Vanina, DF-C2 pregunta 1): igual al de enfermería, pero sin «prestación realizada»
// ni «evolución breve». El profesional abre el turno al llegar, anota los controles que hace y lo cierra
// con su firma y la conformidad de la familia.
export async function abrirTurnoAction(_prev: TurnoState, formData: FormData): Promise<TurnoState> {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") return fail("Solo el profesional asistencial abre su turno de guardia.");
  const patient_id = texto(formData.get("patient_id"), 60);
  if (!patient_id) return fail("Falta el paciente de la guardia.");

  const supabase = await createClient();
  // Solo se abre un turno de una guardia programada para este profesional (hoy, o ayer si la guardia cruza la medianoche).
  const hoy = hoyAR();
  const ayer = new Date(new Date(`${hoy}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const { data: prog } = await supabase
    .from("guardias_programadas")
    .select("id")
    .eq("patient_id", patient_id)
    .eq("profesional_id", profile.id)
    .gte("fecha", ayer)
    .lte("fecha", hoy)
    .limit(1);
  if (!prog || prog.length === 0) return fail("No tenés una guardia programada para este paciente hoy. Si es un error, avisale a Coordinación.");

  const { error } = await supabase.from("turno_guardia").insert({ patient_id, profesional_id: profile.id, estado: "abierto" });
  if (error) {
    if (error.code === "23505") return fail("Ya tenés un turno abierto con este paciente.");
    return fail(`No se pudo abrir el turno: ${error.message}`);
  }
  refrescar();
  await flash("Turno abierto. Anotá los controles a medida que los hacés y cerrá el turno con las dos firmas al terminar.");
  return { error: null, ok: true };
}

export async function agregarControlAction(_prev: TurnoState, formData: FormData): Promise<TurnoState> {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") return fail("Solo el profesional asistencial registra los controles de su guardia.");
  const turno_id = texto(formData.get("turno_id"), 60);
  if (!turno_id) return fail("Falta el turno.");
  const pa = texto(formData.get("pa"), 20) || null;
  const fc = numero(formData.get("fc"), 20, 300);
  const fr = numero(formData.get("fr"), 4, 80);
  const ax = numero(formData.get("ax"), 30, 45);
  if (fc === "mal") return fail("La FC tiene que ser un número entre 20 y 300.");
  if (fr === "mal") return fail("La FR tiene que ser un número entre 4 y 80.");
  if (ax === "mal") return fail("La temperatura axilar tiene que estar entre 30 y 45 °C.");
  if (pa && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(pa)) return fail("La P/A se escribe así: 120/80.");
  const diuresis = siNo(formData.get("diuresis"));
  const catarsis = siNo(formData.get("catarsis"));
  if (!pa && fc == null && fr == null && ax == null && diuresis == null && catarsis == null) return fail("Completá al menos un dato del control.");

  const supabase = await createClient();
  const { error } = await supabase.from("turno_guardia_controles").insert({ turno_id, pa, fc, fr, ax, diuresis, catarsis });
  if (error) return fail("No se pudo guardar el control. Revisá que el turno siga abierto e intentá de nuevo.");
  refrescar();
  return { error: null, ok: true };
}

export async function cerrarTurnoAction(_prev: TurnoState, formData: FormData): Promise<TurnoState> {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") return fail("Solo el profesional asistencial cierra su turno de guardia.");
  const turno_id = texto(formData.get("turno_id"), 60);
  if (!turno_id) return fail("Falta el turno.");
  const narrativa = texto(formData.get("narrativa"), 20000) || null;
  const matricula = texto(formData.get("matricula"), 60);
  if (!matricula) return fail("Completá tu matrícula: va impresa junto a tu firma.");
  const firma = firmaValida(formData.get("firma_profesional_img"));
  if (!firma) return fail("Falta tu firma. Dibujala en el recuadro «Firma del profesional».");
  const conformidad_nombre = texto(formData.get("conformidad_nombre"), 120);
  if (!conformidad_nombre) return fail("Escribí el nombre de quien firma por el paciente o la familia.");
  const conformidad = firmaValida(formData.get("conformidad_img"));
  if (!conformidad) return fail("Falta la firma de conformidad del paciente o familiar.");

  const supabase = await createClient();
  const { count } = await supabase.from("turno_guardia_controles").select("id", { count: "exact", head: true }).eq("turno_id", turno_id);
  if (!count) return fail("Antes de cerrar el turno anotá al menos un control (P/A, FC, FR, temperatura…).");

  const { data: perfil } = await supabase.from("profiles").select("matricula").eq("id", profile.id).maybeSingle();
  if (perfil?.matricula !== matricula) await supabase.from("profiles").update({ matricula }).eq("id", profile.id);

  const { error } = await supabase
    .from("turno_guardia")
    .update({
      estado: "cerrado",
      narrativa,
      firma_profesional_img: firma,
      firma_profesional_nombre: profile.full_name,
      firma_profesional_matricula: matricula,
      conformidad_nombre,
      conformidad_firma: conformidad,
    })
    .eq("id", turno_id)
    .eq("profesional_id", profile.id)
    .eq("estado", "abierto");
  if (error) return fail(`No se pudo cerrar el turno: ${error.message}`);
  refrescar();
  await flash("Turno cerrado y firmado. Queda registrado en la guardia del paciente.");
  return { error: null, ok: true };
}
