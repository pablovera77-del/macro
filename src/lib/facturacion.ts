import type { SemanticTone } from "@/lib/semantic-status";
import { DIAS_CORTOS } from "@/lib/plan";
import type { AppRole } from "@/lib/roles";

/** Resultado de las acciones que se usan con ActionForm: un error legible o nada. */
export type ActionResult = { error?: string } | null;

// Utilidades del módulo de Facturación (C4). Todo lo que depende de "hoy" recibe la fecha
// por parámetro (hoyAR() de lib/plan) para no depender del reloj del servidor.

export function formatARS(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

/** "2026-09-05" -> "05/09/2026" sin pasar por Date (evita corrimientos de zona horaria). */
export function fechaCorta(ymd: string | null | undefined) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function ymdMasDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split("-").map(Number);
  const [y2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/**
 * Fecha límite para presentar un período: fin de mes + los días que da cada obra social.
 * Supuesto: los días se cuentan corridos desde el último día del mes facturado.
 */
export function fechaLimiteFacturacion(periodo: string, diasParaFacturar: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const finDeMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return ymdMasDias(finDeMes, diasParaFacturar);
}

/** Cuánto falta para el vencimiento y con qué tono mostrarlo. Si ya se presentó, no hay alerta. */
export function plazoDePresentacion(
  periodo: string,
  diasParaFacturar: number,
  estado: string,
  hoy: string
): { limite: string; tone: SemanticTone; texto: string } {
  const limite = fechaLimiteFacturacion(periodo, diasParaFacturar);
  const yaPresentada = ["facturado", "cobrada", "debitada", "en_gestion"].includes(estado);
  if (yaPresentada) return { limite, tone: "gris", texto: `Plazo: hasta el ${fechaCorta(limite)}` };
  const faltan = diasEntre(hoy, limite);
  if (faltan < 0) {
    const n = -faltan;
    return { limite, tone: "rojo", texto: `Plazo vencido hace ${n} día${n === 1 ? "" : "s"} (era hasta el ${fechaCorta(limite)})` };
  }
  if (faltan === 0) return { limite, tone: "amarillo", texto: `Hoy vence el plazo para presentar (${fechaCorta(limite)})` };
  if (faltan <= 3) return { limite, tone: "amarillo", texto: `Quedan ${faltan} día${faltan === 1 ? "" : "s"} para presentar (hasta el ${fechaCorta(limite)})` };
  return { limite, tone: "verde", texto: `Presentar hasta el ${fechaCorta(limite)}` };
}

export function describirDias(dias: number[] | null | undefined): string {
  if (!dias || dias.length === 0) return "todos los días";
  return [...dias].sort((a, b) => a - b).map((d) => DIAS_CORTOS[d - 1]).join(", ");
}

export const MODALIDAD_LABELS: Record<string, string> = {
  modulos: "Por módulos",
  prestaciones: "Por prestaciones",
};

// Presupuestos de venta (C4-15/16): Facturación los arma (H8, Vanina 06/10); Dirección solo los consulta.
export const ROLES_PRESUPUESTOS: AppRole[] = ["facturacion", "direccion"];

export function totalPresupuesto(items: { cantidad: number; valor_unitario: number }[]): number {
  return items.reduce((acc, i) => acc + Number(i.cantidad) * Number(i.valor_unitario), 0);
}

/** Fecha hasta la que vale un presupuesto: fecha + validez en días corridos. */
export function vencimientoPresupuesto(fecha: string, validezDias: number): string {
  return ymdMasDias(fecha.slice(0, 10), validezDias);
}

export function numeroPresupuesto(n: number | string): string {
  return `N.º ${String(n).padStart(5, "0")}`;
}
