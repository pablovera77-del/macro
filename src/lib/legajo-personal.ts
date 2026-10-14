// Legajo del personal (DF-C1 pregunta 3): datos personales y documentación adjunta.
import { PRACTICAS } from "@/lib/autorizaciones";

/** Lista cerrada de tipos de profesional (DF-C1 pregunta 15): son las mismas 17 prácticas de las autorizaciones, más «Otros». */
export const TIPOS_PROFESIONAL = PRACTICAS.map((p) => ({ codigo: p.codigo, label: p.label.replace(" (con aclaración)", ""), esp: p.esp }));
export const TIPO_PROFESIONAL_POR_CODIGO = Object.fromEntries(TIPOS_PROFESIONAL.map((t) => [t.codigo, t]));

export const TIPOS_DOCUMENTO_LEGAJO: Record<string, string> = {
  dni: "DNI",
  titulo: "Título",
  matricula: "Matrícula",
  vacunacion: "Certificado de vacunación",
  mala_praxis: "Seguro de mala praxis",
  otro: "Otro documento",
};

export const MAX_BYTES_DOCUMENTO = 5 * 1024 * 1024;
export const TIPOS_ARCHIVO_LEGAJO: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** CUIL con o sin guiones: 11 dígitos. Devuelve el formato XX-XXXXXXXX-X o null si no es válido. */
export function normalizarCuil(v: string): string | null {
  const d = v.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : null;
}
