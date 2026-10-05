// Historia clínica digital (C2): tipos y utilidades compartidas entre el formulario,
// la acción del servidor, el historial y la vista de impresión.
import type { Json } from "@/types/database";

/**
 * Un campo de una plantilla por disciplina (tabla discipline_form_templates.campos).
 * - tipo: "Texto" | "Texto largo" | "Número" | "Sí/No" | "Selección" | "Fecha" | "Fecha y hora" | "Hora" ...
 * - clave: nombre estable con el que se guarda la respuesta (si falta, se usa el nombre del campo sin tildes).
 * - seccion: agrupa campos bajo un subtítulo (ej. "Signos vitales").
 * - narrativa: se omite en la impresión para obra social.
 */
export type Campo = {
  label: string;
  tipo: string;
  obligatorio?: boolean;
  clave?: string;
  seccion?: string;
  opciones?: string[];
  ayuda?: string;
  paso?: string;
  narrativa?: boolean;
};

export type MedicacionItem = {
  cantidad: string;
  droga: string;
  nombre_comercial: string;
  dosis: string;
  frecuencia: string;
};

export type Nova5 = {
  estado_mental: number;
  incontinencia: number;
  movilidad: number;
  nutricion: number;
  actividad: number;
  total: number;
  riesgo: "bajo" | "medio" | "alto";
  movilizacion_indicada?: boolean;
};

export function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Clave con la que se guarda la respuesta de un campo. */
export function campoKey(c: Pick<Campo, "label" | "clave">) {
  return c.clave || slug(c.label);
}

export function parseCampos(raw: unknown): Campo[] {
  return Array.isArray(raw) ? (raw as Campo[]).filter((c) => c && typeof c.label === "string" && typeof c.tipo === "string") : [];
}

/** Escala Nova 5 (riesgo de úlceras por presión): cinco dimensiones, cada una de 0 a 3. */
export const NOVA5_DIMENSIONES: { key: "estado_mental" | "incontinencia" | "movilidad" | "nutricion" | "actividad"; label: string; niveles: [string, string, string, string] }[] = [
  { key: "estado_mental", label: "Estado mental", niveles: ["Alerta", "Desorientado o apático", "Letárgico o hipercinético", "Coma"] },
  { key: "incontinencia", label: "Incontinencia", niveles: ["Ninguna", "Urinaria o fecal ocasional", "Urinaria o fecal habitual", "Urinaria y fecal"] },
  { key: "movilidad", label: "Movilidad", niveles: ["Total", "Ligeramente limitada", "Limitación importante", "Inmóvil"] },
  { key: "nutricion", label: "Nutrición / ingesta", niveles: ["Correcta", "Ocasionalmente incompleta", "Incompleta", "No ingiere"] },
  { key: "actividad", label: "Actividad", niveles: ["Deambula", "Deambula con ayuda", "Siempre precisa ayuda", "En cama"] },
];

/** 1-4 bajo · 5-8 medio · 9-15 alto. Con total 0 no se registra riesgo. */
export function riesgoNova5(total: number): Nova5["riesgo"] | null {
  if (total <= 0) return null;
  return total <= 4 ? "bajo" : total <= 8 ? "medio" : "alto";
}

export const RIESGO_TONE: Record<string, "verde" | "amarillo" | "rojo"> = { bajo: "verde", medio: "amarillo", alto: "rojo" };

export function asNova5(raw: unknown): Nova5 | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Nova5>;
  if (typeof r.total !== "number" || !r.riesgo) return null;
  return r as Nova5;
}

export function asMedicacion(raw: unknown): MedicacionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m) => m && typeof m === "object") as MedicacionItem[];
}

export function asRespuestas(raw: Json | undefined): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (v !== null && v !== undefined && String(v).trim() !== "") out[k] = String(v);
  return out;
}

export type RespuestaItem = { label: string; value: string; narrativa: boolean; largo: boolean };
export type RespuestaSeccion = { titulo: string | null; items: RespuestaItem[] };

function prettyKey(k: string) {
  const t = k.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Ordena las respuestas guardadas según la plantilla (agrupadas por sección).
 * Las respuestas de evoluciones viejas, cuyas claves ya no figuran en la plantilla, se muestran igual al final.
 */
export function resolverRespuestas(respuestas: Record<string, string>, campos: Campo[], modo: "completo" | "os" = "completo"): RespuestaSeccion[] {
  const usadas = new Set<string>();
  const secciones: RespuestaSeccion[] = [];
  for (const c of campos) {
    const key = campoKey(c);
    const value = respuestas[key];
    if (value === undefined) continue;
    usadas.add(key);
    if (modo === "os" && c.narrativa) continue;
    const titulo = c.seccion ?? null;
    let sec = secciones.find((s) => s.titulo === titulo);
    if (!sec) {
      sec = { titulo, items: [] };
      secciones.push(sec);
    }
    sec.items.push({ label: c.label, value, narrativa: !!c.narrativa, largo: c.tipo === "Texto largo" });
  }
  const extra = Object.entries(respuestas).filter(([k]) => !usadas.has(k));
  if (extra.length > 0) {
    secciones.push({
      titulo: secciones.length > 0 ? "Otros datos" : null,
      items: extra.map(([k, v]) => ({ label: prettyKey(k), value: v, narrativa: false, largo: v.length > 60 })),
    });
  }
  return secciones;
}

export const TZ_AR = "America/Argentina/San_Juan";

export function fechaHoraAR(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ_AR }) : "—";
}
export function fechaCortaAR(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ_AR }) : "—";
}

/** Columnas que se piden de una evolución para mostrarla completa (contenido + firmas). */
export const EVOLUCION_COLS =
  "id, patient_id, visit_id, profesional_id, especialidad, template_id, respuestas, upp_escala_nova5, medicacion, alerta_cambio, alerta_motivo, firma_profesional_at, firma_profesional_img, firma_profesional_nombre, firma_profesional_matricula, firma_lat, firma_lng, conformidad_familiar, conformidad_familiar_at, conformidad_nombre, conformidad_firma, conformidad_lat, conformidad_lng, created_at";

export const SIGNATURE_PREFIX = "data:image/png;base64,";
export const SIGNATURE_MAX_LENGTH = 400000;
