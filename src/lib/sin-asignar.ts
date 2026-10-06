// H6 · Alerta de ingreso sin asignar (Vanina 06/10, DF-C3): un paciente activo con prácticas autorizadas vigentes
// queda «sin asignar» hasta que tenga profesional de la disciplina en su equipo (médico, enfermería, kinesiología, fono,
// nutrición, psicología) o, en cuidadores y guardias, un coordinador elegido por Administración.
// Supuesto: «vigente» = el período de la autorización no terminó.
import type { createClient } from "@/lib/supabase/server";
import { PRACTICA_POR_CODIGO } from "@/lib/autorizaciones";
import { hoyAR } from "@/lib/plan";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Prácticas que no tienen un profesional por disciplina: las ordena un coordinador. */
export const PRACTICAS_CON_COORDINADOR = ["cuidadores", "enfermeria_guardias"];
const ESPECIALIDAD_SIN_PROFESIONAL = "otra";

export type Faltante = { tipo: "profesional" | "coordinador"; especialidad: string; practica: string };
export type PacienteSinAsignar = { patient_id: string; nombre: string; faltantes: Faltante[] };

export async function calcularSinAsignar(supabase: Supa, patientId?: string): Promise<PacienteSinAsignar[]> {
  const hoy = hoyAR();
  let qa = supabase.from("treatment_authorizations").select("patient_id, practica_tipo, practica, especialidad, periodo_hasta").gte("periodo_hasta", hoy);
  let qp = supabase.from("patients").select("id, nombre_completo, coordinador_id").eq("estado", "activo");
  let qt = supabase.from("patient_care_team").select("patient_id, especialidad");
  if (patientId) {
    qa = qa.eq("patient_id", patientId);
    qp = qp.eq("id", patientId);
    qt = qt.eq("patient_id", patientId);
  }
  const [{ data: auths }, { data: pacientes }, { data: equipo }] = await Promise.all([qa, qp, qt]);
  const activos = new Map((pacientes ?? []).map((p) => [p.id, p]));
  const cubierto = new Set((equipo ?? []).map((t) => `${t.patient_id}|${t.especialidad}`));
  const porPaciente = new Map<string, Faltante[]>();
  for (const a of auths ?? []) {
    const p = activos.get(a.patient_id);
    if (!p) continue;
    const tipo = a.practica_tipo ?? "";
    const etiqueta = PRACTICA_POR_CODIGO[tipo]?.label ?? a.practica;
    let falta: Faltante | null = null;
    if (PRACTICAS_CON_COORDINADOR.includes(tipo)) {
      if (!p.coordinador_id) falta = { tipo: "coordinador", especialidad: a.especialidad, practica: etiqueta };
    } else if (a.especialidad !== ESPECIALIDAD_SIN_PROFESIONAL && !cubierto.has(`${a.patient_id}|${a.especialidad}`)) {
      falta = { tipo: "profesional", especialidad: a.especialidad, practica: etiqueta };
    }
    if (!falta) continue;
    const lista = porPaciente.get(a.patient_id) ?? [];
    if (!lista.some((f) => f.practica === falta.practica)) lista.push(falta);
    porPaciente.set(a.patient_id, lista);
  }
  return [...porPaciente.entries()]
    .map(([id, faltantes]) => ({ patient_id: id, nombre: activos.get(id)!.nombre_completo, faltantes }))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
}
