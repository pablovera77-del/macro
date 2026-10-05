// Plan de tratamiento por disciplina (DF-C3 §4.3) y su cumplimiento semanal.
//
// Supuestos adoptados hasta que Vanina defina las preguntas abiertas del DF
// (ver roadmap, E3):
//  - "N veces por semana" se toma como la meta exacta de la semana: faltan visitas
//    cuando hay menos de N programadas o realizadas.
//  - "N visitas por día" se toma como N por cada día indicado (todos los días si no
//    se indican días específicos).
//  - Una visita reprogramada dentro de la misma semana sigue contando para esa semana.
//  - Cuentan las visitas programadas, confirmadas y realizadas; no cuentan las
//    canceladas ni las no realizadas.

export const TZ = "America/Argentina/San_Juan";

// Disciplinas del plan (DF-C3 §4.3 + equipo §4.2): la lista única que se usa en el alta.
export const DISCIPLINAS_PLAN = ["medicina", "enfermeria", "kinesiologia", "fonoaudiologia", "nutricion", "psicologia"] as const;
export type DisciplinaPlan = (typeof DISCIPLINAS_PLAN)[number];

// 1 = lunes … 7 = domingo
export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type Plan = {
  id: string;
  patient_id: string;
  especialidad: string;
  cantidad: number;
  unidad: string; // "dia" | "semana"
  dias_semana: number[] | null;
  desde: string;
  hasta: string | null;
  activo: boolean;
  nota: string | null;
};

export function describirPlan(p: Pick<Plan, "cantidad" | "unidad" | "dias_semana">): string {
  const dias = p.dias_semana && p.dias_semana.length > 0 ? [...p.dias_semana].sort().map((d) => DIAS_CORTOS[d - 1]).join(", ") : null;
  const base = p.unidad === "dia" ? `${p.cantidad} por día` : `${p.cantidad} por semana`;
  return dias ? `${base} (${dias})` : base;
}

export function esperadasPorSemana(p: Pick<Plan, "cantidad" | "unidad" | "dias_semana">): number {
  if (p.unidad === "dia") return p.cantidad * (p.dias_semana && p.dias_semana.length > 0 ? p.dias_semana.length : 7);
  return p.cantidad;
}

function ymdEnSanJuan(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d);
}

/** Fecha (AAAA-MM-DD) de un instante, en hora de San Juan. */
export function ymdAR(d: Date | string): string {
  return ymdEnSanJuan(typeof d === "string" ? new Date(d) : d);
}

/** «Hoy» en hora de San Juan: después de las 21:00 el UTC ya es «mañana». */
export function hoyAR(): string {
  return ymdEnSanJuan(new Date());
}

/** Lunes 00:00 → lunes siguiente 00:00 (hora de San Juan, UTC-3 sin horario de verano). */
export function semanaActual(ahora = new Date()): { desde: string; hasta: string; diasTranscurridos: number } {
  const ymd = ymdEnSanJuan(ahora);
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  const desdeLunes = (dow + 6) % 7; // días desde el lunes
  const lunes = new Date(Date.UTC(y, m - 1, d - desdeLunes));
  const proximo = new Date(Date.UTC(y, m - 1, d - desdeLunes + 7));
  const iso = (x: Date) => `${x.toISOString().slice(0, 10)}T00:00:00-03:00`;
  return { desde: new Date(iso(lunes)).toISOString(), hasta: new Date(iso(proximo)).toISOString(), diasTranscurridos: desdeLunes + 1 };
}

export type VisitaMin = { patient_id: string; especialidad: string; fecha_programada: string; estado: string };

export type Cumplimiento = {
  plan: Plan;
  esperadas: number;
  cubiertas: number; // programadas + confirmadas + realizadas en la semana
  realizadas: number;
  faltan: number;
  sobran: number;
};

export function calcularCumplimiento(planes: Plan[], visitas: VisitaMin[], semana = semanaActual()): Cumplimiento[] {
  return planes
    .filter((p) => p.activo)
    .map((plan) => {
      const enSemana = visitas.filter(
        (v) =>
          v.patient_id === plan.patient_id &&
          v.especialidad === plan.especialidad &&
          v.fecha_programada >= semana.desde &&
          v.fecha_programada < semana.hasta &&
          (v.estado === "programada" || v.estado === "confirmada" || v.estado === "realizada")
      );
      const esperadas = esperadasPorSemana(plan);
      const cubiertas = enSemana.length;
      return {
        plan,
        esperadas,
        cubiertas,
        realizadas: enSemana.filter((v) => v.estado === "realizada").length,
        faltan: Math.max(0, esperadas - cubiertas),
        sobran: Math.max(0, cubiertas - esperadas),
      };
    });
}

/**
 * Promedio diario de visitas realizadas por profesional por debajo del cual la coordinación
 * quiere enterarse (R63). Valor provisorio: pasa a parámetro editable cuando exista la configuración.
 */
export const UMBRAL_VISITAS_DIA = 6;
