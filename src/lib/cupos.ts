// H11 · Cupos por módulo (Vanina 06/10, DF-C2). Es una GUÍA: pasarse se marca en rojo, no bloquea
// (decisión pendiente: tope duro o guía, DF-C2 pregunta de cupos).
// Supuesto a confirmar: el cupo de kinesiología respiratoria (12) se toma por semana, igual que el de motora.

export const CUPOS = {
  enfermeria_modulo: { nombre: "Enfermería · módulo completo", tope: 12, periodo: "dia", detalle: "hasta 12 visitas por día" },
  enfermeria_medio: { nombre: "Enfermería · medio módulo", tope: 6, periodo: "dia", detalle: "hasta 6 visitas por día" },
  kine_motora: { nombre: "Kinesiología motora", tope: 25, periodo: "semana", detalle: "hasta 25 sesiones por semana, de lunes a viernes (la guardia de fin de semana va aparte)" },
  kine_respiratoria: { nombre: "Kinesiología respiratoria", tope: 12, periodo: "semana", detalle: "hasta 12 (se toma por semana; a confirmar)" },
} as const;

export type CupoCodigo = keyof typeof CUPOS;
export const CUPO_CODIGOS = Object.keys(CUPOS) as CupoCodigo[];
export const esCupo = (v: string): v is CupoCodigo => v in CUPOS;

export type Semaforo = "verde" | "amarillo" | "rojo";

/** Verde dentro del cupo, amarillo cerca (80 % o más), rojo excedido. */
export function semaforoCupo(asignadas: number, tope: number): Semaforo {
  if (asignadas > tope) return "rojo";
  if (asignadas >= Math.ceil(tope * 0.8)) return "amarillo";
  return "verde";
}

export type VisitaCupo = { profesional_id: string; estado: string; fecha_programada: string; fecha_realizada: string | null };

/**
 * Asignado = visitas programadas, confirmadas o realizadas del período; realizado = las realizadas.
 * Período diario: el día de hoy. Semanal: de lunes a viernes de la semana (las del fin de semana no cuentan para kinesiología motora).
 */
export function contarCupo(
  cupo: CupoCodigo,
  visitas: VisitaCupo[],
  hoy: string,
  semana: { desde: string; hasta: string },
  ymd: (iso: string) => string
) {
  const def = CUPOS[cupo];
  let asignadas = 0;
  let realizadas = 0;
  for (const v of visitas) {
    if (v.estado === "cancelada" || v.estado === "no_realizada") continue;
    const dia = ymd(v.fecha_programada);
    if (def.periodo === "dia") {
      if (dia !== hoy) continue;
    } else {
      const t = new Date(v.fecha_programada).getTime();
      if (t < new Date(semana.desde).getTime() || t >= new Date(semana.hasta).getTime()) continue;
      const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) continue;
    }
    asignadas += 1;
    if (v.estado === "realizada") realizadas += 1;
  }
  return { asignadas, realizadas, tope: def.tope, semaforo: semaforoCupo(asignadas, def.tope) };
}
