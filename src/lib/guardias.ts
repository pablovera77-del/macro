// H12 · Guardias del mes (Vanina 06/10, DF-C2). `guardias_programadas` es lo que debe cubrirse;
// `turno_guardia` (ingreso/egreso del profesional en el domicilio) es lo que se hizo.

import type { AppRole } from "@/lib/roles";

/** Quién arma las guardias. */
export const ROLES_GUARDIAS: AppRole[] = ["coordinador_internacion", "administracion"];

export const TRAMOS: Record<string, { label: string; dias: number[] }> = {
  lunes_a_viernes: { label: "Lunes a viernes", dias: [1, 2, 3, 4, 5] },
  fin_de_semana: { label: "Sábado y domingo", dias: [6, 0] },
  todos: { label: "Todos los días", dias: [0, 1, 2, 3, 4, 5, 6] },
};

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HORA_RE = /^\d{2}:\d{2}$/;

const sumarDias = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Fechas del rango que caen en alguno de los días de la semana (0 = domingo). Máximo 62 días de rango. */
export function fechasPorTramo(desde: string, hasta: string, dias: number[]): string[] {
  const out: string[] = [];
  for (let f = desde, i = 0; f <= hasta && i < 62; f = sumarDias(f, 1), i++) {
    if (dias.includes(new Date(`${f}T12:00:00Z`).getUTCDay())) out.push(f);
  }
  return out;
}

/** N días seguidos desde una fecha. */
export function fechasConsecutivas(desde: string, cantidad: number): string[] {
  return Array.from({ length: Math.max(0, Math.min(cantidad, 62)) }, (_, i) => sumarDias(desde, i));
}

export function limitesDelMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

export const mesValido = (m: string | undefined) => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function mesVecino(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Un turno abierto hace más de este tiempo se marca como olvidado (a confirmar con Vanina). */
export const HORAS_TURNO_ABIERTO = 14;

/** Turnos abiertos hace más de HORAS_TURNO_ABIERTO horas (el profesional se olvidó de cerrar). */
export function turnosOlvidados<T extends { hora_ingreso: string }>(abiertos: T[], ahora = new Date()): T[] {
  return abiertos.filter((t) => ahora.getTime() - new Date(t.hora_ingreso).getTime() > HORAS_TURNO_ABIERTO * 3600000);
}
