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

// H1 (Vanina 06/10): unidad de trabajo y tipo de internación, que depende de la unidad.
export const UNIDADES_TRABAJO: Record<string, string> = {
  profesionales: "Profesionales",
  expertos: "Expertos",
  malleo_lodge_1: "Malleo Lodge I",
  malleo_lodge_2: "Malleo Lodge II",
  san_juan_salud: "San Juan Salud",
};
export const TIPOS_INTERNACION: Record<string, string> = {
  visitas: "Visitas",
  soporte_nutricional_enteral: "Soporte nutricional enteral",
  soporte_nutricional_parenteral: "Soporte nutricional parenteral",
  complejizada: "Complejizada",
  centro_de_dia: "Centro de día",
  estadia_permanente: "Estadía permanente",
  plan_esencial: "Plan Esencial",
  plan_premium: "Plan Premium",
};
export const TIPOS_POR_UNIDAD: Record<string, string[]> = {
  profesionales: ["visitas", "soporte_nutricional_enteral", "soporte_nutricional_parenteral", "complejizada"],
  expertos: ["visitas", "soporte_nutricional_enteral", "soporte_nutricional_parenteral", "complejizada"],
  malleo_lodge_1: ["centro_de_dia", "estadia_permanente"],
  malleo_lodge_2: ["centro_de_dia", "estadia_permanente"],
  san_juan_salud: ["plan_esencial", "plan_premium"],
};
/** Texto que muestra la ficha cuando el paciente no tiene servicio de emergencias contratado. */
export const SIN_EMERGENCIAS = "Debe llamar al 107";
/** Apellido y nombre en el orden en que se muestran en toda la plataforma. */
export function nombreCompleto(nombre: string, apellido: string): string {
  return `${nombre.trim()} ${apellido.trim()}`.replace(/\s+/g, " ").trim();
}
