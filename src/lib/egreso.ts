// Motivos de egreso (DF-C3 §11 y §11.1): un único mapa de etiquetas para toda la plataforma.
// Los valores viejos del enum (alta, fin_internacion) se conservan y se muestran con su etiqueta;
// la app solo ofrece los valores nuevos al informar o confirmar un egreso.
import { TZ } from "@/lib/plan";

export const MOTIVO_EGRESO_LABELS: Record<string, string> = {
  alta_medica: "Alta médica",
  alta: "Alta médica",
  fallecimiento: "Fallecimiento",
  traslado_otro_domicilio: "Se trasladó a otro domicilio",
  traslado_otra_institucion: "Se trasladó a otra institución (sanatorio)",
  internacion_otro: "Otro motivo",
  fin_internacion: "Fin de internación",
};

/** Motivos que se ofrecen hoy al informar o confirmar un egreso. */
export const MOTIVOS_EGRESO_OPCIONES = ["alta_medica", "fallecimiento", "traslado_otro_domicilio", "traslado_otra_institucion", "internacion_otro"] as const;
export type MotivoEgresoNuevo = (typeof MOTIVOS_EGRESO_OPCIONES)[number];

export function motivoEgresoLabel(m: string | null | undefined): string {
  if (!m) return "—";
  return MOTIVO_EGRESO_LABELS[m] ?? m;
}

/** Un motivo guardado con el valor viejo (alta) se precarga como el nuevo equivalente (alta_medica). */
export function motivoParaFormulario(m: string | null | undefined): string {
  if (!m) return "";
  return m === "alta" ? "alta_medica" : m;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** «AAAA-MM-DDTHH:mm» en hora de San Juan, para precargar un campo datetime-local. */
export function datetimeLocalAR(d: Date | string = new Date()): string {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(typeof d === "string" ? new Date(d) : d);
  // sv-SE devuelve «2026-10-05 14:30»
  return f.replace(" ", "T");
}

/** Convierte el valor de un datetime-local (hora de San Juan, UTC-3 todo el año) a un instante ISO. null si no es válido. */
export function parseDatetimeLocalAR(v: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v ?? ""));
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${pad(Number(m[4]))}:${m[5]}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
