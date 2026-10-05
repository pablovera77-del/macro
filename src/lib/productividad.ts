import { UMBRAL_VISITAS_DIA, semanaActual, ymdAR } from "@/lib/plan";
import type { AppRole } from "@/lib/roles";

// Productividad de cada profesional (R63, R64, R65): visitas realizadas, días con actividad y
// promedio diario. Supuestos: una visita realizada cuenta en el día de su cierre
// (`fecha_realizada`, o su fecha programada si falta); el promedio es realizadas / días en los
// que el profesional hizo al menos una visita (no días corridos), en los últimos 30 días.

export const DIAS_PRODUCTIVIDAD = 30;

export type VisitaProd = {
  profesional_id: string;
  especialidad: string;
  estado: string;
  fecha_programada: string;
  fecha_realizada: string | null;
};

export type FilaProductividad = {
  profesional_id: string;
  disciplinas: string[];
  realizadas: number;
  diasActivos: number;
  promedioDiario: number;
  realizadasSemana: number;
  bajoUmbral: boolean;
};

export function calcularProductividad(visitas: VisitaProd[], ahora = new Date(), dias = DIAS_PRODUCTIVIDAD, umbral = UMBRAL_VISITAS_DIA): FilaProductividad[] {
  const desde = new Date(ahora.getTime() - dias * 86400000).getTime();
  const sem = semanaActual(ahora);
  const porProf = new Map<string, { disc: Set<string>; dias: Set<string>; total: number; semana: number }>();
  for (const v of visitas) {
    if (v.estado !== "realizada") continue;
    const cuando = v.fecha_realizada ?? v.fecha_programada;
    const t = new Date(cuando).getTime();
    if (t < desde || t > ahora.getTime()) continue;
    const e = porProf.get(v.profesional_id) ?? { disc: new Set<string>(), dias: new Set<string>(), total: 0, semana: 0 };
    e.disc.add(v.especialidad);
    e.dias.add(ymdAR(cuando));
    e.total += 1;
    if (t >= new Date(sem.desde).getTime() && t < new Date(sem.hasta).getTime()) e.semana += 1;
    porProf.set(v.profesional_id, e);
  }
  return [...porProf.entries()]
    .map(([profesional_id, e]) => {
      const promedio = e.dias.size > 0 ? e.total / e.dias.size : 0;
      return {
        profesional_id,
        disciplinas: [...e.disc],
        realizadas: e.total,
        diasActivos: e.dias.size,
        promedioDiario: Math.round(promedio * 10) / 10,
        realizadasSemana: e.semana,
        bajoUmbral: promedio < umbral,
      };
    })
    .sort((a, b) => b.promedioDiario - a.promedioDiario);
}

/** Quién puede ver «Productividad y cupos» (solo lectura): Coordinación, Administración y Dirección. */
export const ROLES_PRODUCTIVIDAD: AppRole[] = ["coordinador_internacion", "administracion", "direccion"];
