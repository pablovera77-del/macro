// Autorizaciones de práctica estandarizadas (H3, Vanina 06/10) y renovación con historial (H4).
// Sin "use server": lo comparten las acciones del ingreso y los formularios.
import type { Enums } from "@/types/database";

export type Especialidad = Enums<"specialty">;

/** Lista cerrada de prácticas (en lugar de texto libre). `esp` es la disciplina con la que se controlan las evoluciones. */
export const PRACTICAS: { codigo: string; label: string; esp: Especialidad }[] = [
  { codigo: "medico", label: "Médico", esp: "medicina" },
  { codigo: "enfermeria_visitas", label: "Enfermería visitas", esp: "enfermeria" },
  { codigo: "kine_respiratoria", label: "Kinesiología respiratoria", esp: "kinesiologia" },
  { codigo: "kine_motora", label: "Kinesiología motora", esp: "kinesiologia" },
  { codigo: "neuroestimulacion", label: "Neuroestimulación", esp: "kinesiologia" },
  { codigo: "deglucion", label: "Deglución", esp: "fonoaudiologia" },
  { codigo: "cuidadores", label: "Cuidadores", esp: "otra" },
  { codigo: "enfermeria_guardias", label: "Enfermería guardias", esp: "enfermeria" },
  { codigo: "nutricion", label: "Nutrición", esp: "nutricion" },
  { codigo: "fonoaudiologia", label: "Fonoaudiología", esp: "fonoaudiologia" },
  { codigo: "psicologia", label: "Psicología", esp: "psicologia" },
  { codigo: "psicopedagogia", label: "Psicopedagogía", esp: "otra" },
  { codigo: "psicomotricidad", label: "Psicomotricidad", esp: "otra" },
  { codigo: "acompanante_terapeutico", label: "Acompañante terapéutico", esp: "otra" },
  { codigo: "terapista_ocupacional", label: "Terapista ocupacional", esp: "otra" },
  { codigo: "estimulacion_visual", label: "Estimulación visual", esp: "otra" },
  { codigo: "interconsulta", label: "Interconsulta médico especialista", esp: "medicina" },
  { codigo: "otros", label: "Otros (con aclaración)", esp: "otra" },
];
export const PRACTICA_POR_CODIGO = Object.fromEntries(PRACTICAS.map((p) => [p.codigo, p]));

export const UNIDADES_FRECUENCIA: Record<string, string> = { visita: "visita(s)", sesion: "sesión(es)", horas: "hora(s)" };
export const PERIODOS_FRECUENCIA: Record<string, string> = { dia: "día", semana: "semana", quincena: "quincena", mes: "mes" };
const DIAS_DEL_PERIODO: Record<string, number> = { dia: 1, semana: 7, quincena: 15, mes: 30 };

export type Renglon = {
  practica_tipo: string;
  practica: string; // etiqueta legible (la que se muestra y se compara)
  practica_aclaracion: string | null;
  especialidad: Especialidad;
  frecuencia_cantidad: number;
  frecuencia_unidad: string;
  frecuencia_periodo: string;
  dias_semana: number[];
  // Lo que usan los controles de Facturación (DF-C4 §4): solo se completan cuando la frecuencia se puede controlar con evoluciones.
  frecuencia_tipo: "diaria" | "semanal" | null;
  veces_por_dia: number | null;
  cantidad_autorizada: number;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1;
}

/** Cantidad total estimada para el período autorizado (informativa: la obra social autoriza por frecuencia). */
export function totalEstimado(r: { cantidad: number; periodo: string; dias: number[] }, desde: string, hasta: string) {
  const dias = Math.max(diasEntre(desde, hasta), 1);
  if (r.periodo === "dia") {
    if (r.dias.length === 0) return r.cantidad * dias;
    let n = 0;
    for (let i = 0; i < dias; i++) {
      const iso = ((new Date(Date.parse(`${desde}T00:00:00Z`) + i * 86400000).getUTCDay() + 6) % 7) + 1;
      if (r.dias.includes(iso)) n++;
    }
    return r.cantidad * n;
  }
  return r.cantidad * Math.ceil(dias / DIAS_DEL_PERIODO[r.periodo]);
}

/** Texto corto de la frecuencia: «3 visita(s) por semana (L, X, V)». */
export function frecuenciaTexto(a: { frecuencia_cantidad: number | null; frecuencia_unidad: string | null; frecuencia_periodo: string | null; dias_semana: number[] | null }) {
  if (!a.frecuencia_cantidad || !a.frecuencia_unidad || !a.frecuencia_periodo) return null;
  const dias = a.dias_semana?.length ? ` (${a.dias_semana.map((d) => ["L", "M", "X", "J", "V", "S", "D"][d - 1]).join(", ")})` : "";
  return `${a.frecuencia_cantidad} ${UNIDADES_FRECUENCIA[a.frecuencia_unidad] ?? a.frecuencia_unidad} por ${PERIODOS_FRECUENCIA[a.frecuencia_periodo] ?? a.frecuencia_periodo}${dias}`;
}

/**
 * Lee los renglones del formulario (campos `r<n>_tipo`, `r<n>_aclaracion`, `r<n>_cantidad`, `r<n>_unidad`, `r<n>_periodo`, `r<n>_dias`).
 * Valida y calcula lo que necesitan los controles de Facturación.
 */
export function leerRenglones(fd: FormData, desde: string, hasta: string): { error: string } | { renglones: Renglon[] } {
  if (!FECHA.test(desde)) return { error: "Falta la fecha de ingreso al servicio (inicio de la autorización)." };
  if (!FECHA.test(hasta)) return { error: "Falta el vencimiento de la autorización." };
  if (hasta < desde) return { error: "El vencimiento de la autorización no puede ser anterior a su inicio." };

  const idx = [...new Set([...fd.keys()].map((k) => /^r(\d+)_tipo$/.exec(k)?.[1]).filter((x): x is string => !!x))].sort((a, b) => Number(a) - Number(b));
  const renglones: Renglon[] = [];
  for (const n of idx) {
    const tipo = String(fd.get(`r${n}_tipo`) || "");
    const aclaracion = String(fd.get(`r${n}_aclaracion`) || "").trim() || null;
    const cantidad = Number(fd.get(`r${n}_cantidad`) || 0);
    const unidad = String(fd.get(`r${n}_unidad`) || "");
    const periodo = String(fd.get(`r${n}_periodo`) || "");
    const dias = [...new Set(fd.getAll(`r${n}_dias`).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
    if (!tipo && !aclaracion && !cantidad) continue; // renglón vacío
    const num = renglones.length + 1;
    const pr = PRACTICA_POR_CODIGO[tipo];
    if (!pr) return { error: `Renglón ${num}: elegí la práctica de la lista.` };
    if (tipo === "otros" && !aclaracion) return { error: `Renglón ${num}: para «Otros» escribí la aclaración de qué práctica es.` };
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 30) return { error: `Renglón ${num}: la cantidad tiene que ser un número entre 1 y 30.` };
    if (!UNIDADES_FRECUENCIA[unidad]) return { error: `Renglón ${num}: elegí la unidad (visita, sesión u horas).` };
    if (!PERIODOS_FRECUENCIA[periodo]) return { error: `Renglón ${num}: elegí el período (día, semana, quincena o mes).` };
    if (dias.length > 0 && periodo !== "dia" && periodo !== "semana") return { error: `Renglón ${num}: los días de la semana solo se marcan cuando la frecuencia es por día o por semana.` };

    // Controlable con evoluciones: visitas o sesiones, por día o por semana.
    let frecuencia_tipo: Renglon["frecuencia_tipo"] = null;
    let veces_por_dia: number | null = null;
    if (unidad !== "horas") {
      if (periodo === "dia") {
        frecuencia_tipo = "diaria";
        veces_por_dia = cantidad;
      } else if (periodo === "semana" && dias.length > 0) {
        if (cantidad % dias.length !== 0) return { error: `Renglón ${num}: marcaste ${dias.length} día(s) pero la frecuencia es ${cantidad} por semana; no coinciden. Marcá ${cantidad} día(s) o un divisor (por ejemplo 6 por semana en 3 días = 2 por día).` };
        frecuencia_tipo = "semanal";
        veces_por_dia = cantidad / dias.length;
      }
    }
    renglones.push({
      practica_tipo: tipo,
      practica: tipo === "otros" ? `Otros: ${aclaracion}` : pr.label,
      practica_aclaracion: aclaracion,
      especialidad: pr.esp,
      frecuencia_cantidad: cantidad,
      frecuencia_unidad: unidad,
      frecuencia_periodo: periodo,
      dias_semana: dias,
      frecuencia_tipo,
      veces_por_dia,
      cantidad_autorizada: totalEstimado({ cantidad, periodo, dias }, desde, hasta),
    });
  }
  if (renglones.length === 0) return { error: "Cargá al menos una práctica autorizada." };
  return { renglones };
}
