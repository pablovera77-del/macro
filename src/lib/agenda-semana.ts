import { createClient } from "@/lib/supabase/server";
import { esperadasPorSemana, semanaActual, ymdAR, type Plan } from "@/lib/plan";

// Agenda recurrente (benchmark UX, prioridad 1): propone las visitas de una semana a partir del
// plan de tratamiento activo y el equipo asignado, sin duplicar lo que ya está programado.
//
// Supuestos (a validar con el cliente):
//  - Plan «N por día» con días: N visitas en cada uno de esos días (todos los días si no se indican).
//  - Plan «N por semana» sin días: se reparten parejo en la semana (3 por semana = lunes, miércoles y viernes).
//  - Plan «N por semana» con días: se usan esos días primero.
//  - Nunca se proponen visitas en días que ya pasaron ni fuera de las fechas «desde/hasta» del plan.
//  - Una visita ya programada/confirmada/realizada de ese paciente y disciplina en el día cuenta para ese día.
//  - La hora la define Coordinación al confirmar (por defecto «sin hora definida»).

export type VisitaExistente = { patient_id: string; especialidad: string; fecha_programada: string; estado: string };

export type Propuesta = {
  key: string; // paciente|disciplina|día|n
  patient_id: string;
  especialidad: string;
  profesional_id: string | null;
  ymd: string;
  /** 0 = esta semana, 1 = la próxima */
  semana: 0 | 1;
};

const sumarDias = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
// 1 = lunes … 7 = domingo
const diaIso = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
};

/** Días de la semana a repartir: i * 7 / n redondeado hacia abajo (3 -> lun, mié, vie). */
function repartir(n: number, dias: string[]): string[] {
  const cant = Math.min(n, 7);
  return Array.from({ length: cant }, (_, i) => dias[Math.floor((i * 7) / cant)]);
}

export function proponerVisitas(opts: {
  planes: Plan[];
  visitas: VisitaExistente[];
  equipo: Map<string, string>; // `${patient_id}|${especialidad}` -> profesional_id
  semanaLunes: string; // ymd del lunes
  semana: 0 | 1;
  hoy: string; // ymd
}): Propuesta[] {
  const { planes, visitas, equipo, semanaLunes, semana, hoy } = opts;
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(semanaLunes, i));
  const out: Propuesta[] = [];

  for (const plan of planes) {
    if (!plan.activo) continue;
    const habilitados = dias.filter((d) => d >= hoy && d >= plan.desde && (!plan.hasta || d <= plan.hasta));
    if (habilitados.length === 0) continue;
    const prof = equipo.get(`${plan.patient_id}|${plan.especialidad}`) ?? null;

    const enSemana = visitas.filter(
      (v) =>
        v.patient_id === plan.patient_id &&
        v.especialidad === plan.especialidad &&
        (v.estado === "programada" || v.estado === "confirmada" || v.estado === "realizada") &&
        dias.includes(ymdAR(v.fecha_programada))
    );
    const porDia = new Map<string, number>();
    for (const v of enSemana) porDia.set(ymdAR(v.fecha_programada), (porDia.get(ymdAR(v.fecha_programada)) ?? 0) + 1);

    const agregar = (ymd: string, n: number) => {
      for (let i = 0; i < n; i++)
        out.push({ key: `${plan.patient_id}|${plan.especialidad}|${ymd}|${(porDia.get(ymd) ?? 0) + i + 1}`, patient_id: plan.patient_id, especialidad: plan.especialidad, profesional_id: prof, ymd, semana });
    };

    const diasPlan = plan.dias_semana && plan.dias_semana.length > 0 ? plan.dias_semana : null;
    if (plan.unidad === "dia") {
      for (const d of habilitados) {
        if (diasPlan && !diasPlan.includes(diaIso(d))) continue;
        agregar(d, Math.max(0, plan.cantidad - (porDia.get(d) ?? 0)));
      }
      continue;
    }

    // «N por semana»
    let faltan = Math.max(0, esperadasPorSemana(plan) - enSemana.length);
    if (faltan === 0) continue;
    const objetivo = diasPlan ? dias.filter((d) => diasPlan.includes(diaIso(d))) : repartir(plan.cantidad, dias);
    const orden = [...objetivo, ...dias.filter((d) => !objetivo.includes(d))];
    for (const d of orden) {
      if (faltan === 0) break;
      if (!habilitados.includes(d) || (porDia.get(d) ?? 0) > 0) continue;
      agregar(d, 1);
      faltan -= 1;
    }
  }
  return out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.key.localeCompare(b.key));
}

/** Carga planes, equipo y visitas y arma las propuestas de esta semana y de la próxima. */
export async function cargarPropuestasSemana(ahora = new Date()) {
  const supabase = await createClient();
  const hoy = ymdAR(ahora);
  const sem0 = semanaActual(ahora);
  const sem1 = semanaActual(new Date(ahora.getTime() + 7 * 86400000));
  const lunes0 = ymdAR(new Date(sem0.desde));
  const lunes1 = ymdAR(new Date(sem1.desde));

  const [{ data: pacientes }, { data: planes }, { data: equipoRaw }, { data: visitas }, { data: profes }] = await Promise.all([
    supabase.from("patients").select("id, nombre_completo").eq("estado", "activo"),
    supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota").eq("activo", true),
    supabase.from("patient_care_team").select("patient_id, especialidad, profesional_id"),
    supabase.from("visits").select("patient_id, especialidad, fecha_programada, estado").gte("fecha_programada", sem0.desde).lt("fecha_programada", sem1.hasta),
    supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true),
  ]);

  const nombres = new Map((pacientes ?? []).map((p) => [p.id, p.nombre_completo]));
  const profesionales = new Map((profes ?? []).map((p) => [p.id, p.full_name]));
  // Un profesional dado de baja no se propone: la fila queda «sin profesional» hasta reasignar.
  const equipo = new Map<string, string>();
  for (const t of equipoRaw ?? []) if (profesionales.has(t.profesional_id)) equipo.set(`${t.patient_id}|${t.especialidad}`, t.profesional_id);

  const planesActivos = ((planes ?? []) as unknown as Plan[]).filter((p) => nombres.has(p.patient_id));
  const existentes = (visitas ?? []) as VisitaExistente[];
  const propuestas = [
    ...proponerVisitas({ planes: planesActivos, visitas: existentes, equipo, semanaLunes: lunes0, semana: 0, hoy }),
    ...proponerVisitas({ planes: planesActivos, visitas: existentes, equipo, semanaLunes: lunes1, semana: 1, hoy }),
  ];
  return { propuestas, nombres, profesionales };
}
