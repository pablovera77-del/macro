// Utilidades del legajo del paciente (DF-C3 §4.1). Sin dependencias de servidor: se usan también en componentes cliente.
import { hoyAR } from "@/lib/plan";

export const SEXO_LABELS: Record<string, string> = { femenino: "Femenino", masculino: "Masculino", otro: "Otro / no binario" };
export const ESTADO_PACIENTE_LABELS: Record<string, string> = {
  admitido_pendiente_llegada: "Admitido, pendiente de llegada",
  activo: "Activo",
  dado_de_baja: "Dado de baja",
};

/** Edad en años cumplidos (hora de San Juan). null si no hay fecha de nacimiento válida. */
export function edadEnAnios(fechaNacimiento: string | null | undefined, hoy: string = hoyAR()): number | null {
  if (!fechaNacimiento) return null;
  const [y, m, d] = fechaNacimiento.slice(0, 10).split("-").map(Number);
  const [hy, hm, hd] = hoy.split("-").map(Number);
  if (!y || !m || !d) return null;
  let edad = hy - y;
  if (hm < m || (hm === m && hd < d)) edad -= 1;
  return edad >= 0 ? edad : null;
}

/** «12/09/2026» a partir de «2026-09-12» (sin pasar por Date, para no correr un día por la zona horaria). */
export function fechaCorta(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
