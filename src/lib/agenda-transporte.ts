// Agenda de Transporte (C5 §4.4): qué tareas toca ver en un día dado.
import { ymdAR } from "@/lib/plan";

export type TareaT = {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  duracion_min: number;
  prioridad: string;
  estado: string;
  permanente: boolean;
  repeticion: string | null;
  dias_semana: number[] | null;
  order_id: string | null;
  patient_id: string | null;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  iniciada_at: string | null;
  completada_at: string | null;
  aviso_en_camino_at: string | null;
  reprogramada_desde: string | null;
  reprogramaciones: number;
  nota_reprogramacion: string | null;
};

/** Día de la semana de una fecha AAAA-MM-DD: 1 = lunes … 7 = domingo. */
export function diaSemana(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00-03:00`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function sumarDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymdAR(d);
}

/** ¿La tarea permanente cae en ese día? (desde su fecha de inicio en adelante) */
export function permanenteCaeEn(t: Pick<TareaT, "fecha" | "repeticion" | "dias_semana">, ymd: string): boolean {
  if (ymd < t.fecha) return false;
  if (t.repeticion === "semanal") {
    const dias = t.dias_semana && t.dias_semana.length > 0 ? t.dias_semana : [diaSemana(t.fecha)];
    return dias.includes(diaSemana(ymd));
  }
  if (t.repeticion === "mensual") return t.fecha.slice(8, 10) === ymd.slice(8, 10);
  return true; // diaria
}

export const PRIORIDAD_ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 };
export const PRIORIDAD_LABEL: Record<string, string> = { alta: "Prioridad alta", media: "Prioridad media", baja: "Prioridad baja" };
export const TIPO_LABEL: Record<string, string> = { entrega: "Entrega", retiro: "Retiro", otro: "Otra tarea" };

/** «09:30» a partir de «09:30:00». */
export const horaCorta = (h: string | null) => (h ? h.slice(0, 5) : null);

/** Minutos desde medianoche. */
export function minutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

/** ¿Dos tareas con hora se superponen? */
export function seSuperponen(a: { hora: string | null; duracion_min: number }, b: { hora: string | null; duracion_min: number }): boolean {
  if (!a.hora || !b.hora) return false;
  const a0 = minutos(a.hora), b0 = minutos(b.hora);
  return a0 < b0 + b.duracion_min && b0 < a0 + a.duracion_min;
}
