// Semáforo de vencimiento de autorizaciones de práctica (DF-C3 §8 y §10).
//
// Los días restantes se calculan ACÁ, en hora de San Juan, y no en la vista de la base
// (v_treatment_authorization_status usa la fecha del servidor y solo distingue 3 estados).
//   rojo     = vencida o vence en 2 días o menos
//   amarillo = vence en 3 a 7 días (escalones de aviso: 7, 5 y 2 días)
//   verde    = vence en más de 7 días
// Este archivo se importa desde componentes de servidor: autorizacionVencida() usa la sesión del usuario.
import { cache } from "react";
import { hoyAR } from "@/lib/plan";
import type { SemanticTone } from "@/lib/semantic-status";

export type AutorizacionMin = {
  patient_id?: string | null;
  periodo_hasta: string | null;
  especialidad?: string | null;
  practica?: string | null;
};

export type Semaforo = {
  /** Días hasta el vencimiento (negativo = ya venció). null = sin autorización cargada. */
  dias: number | null;
  tone: SemanticTone;
  label: string;
  /** Escalón de aviso alcanzado: 0 vencida/hoy, 2, 5 o 7 días. null si falta más de una semana. */
  escalon: 0 | 2 | 5 | 7 | null;
};

const MS_DIA = 86_400_000;
const ymdAUtc = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function diasRestantes(periodoHasta: string, hoy: string = hoyAR()): number {
  return Math.round((ymdAUtc(periodoHasta) - ymdAUtc(hoy)) / MS_DIA);
}

const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

export function semaforoPorDias(n: number): Semaforo {
  if (n < 0) return { dias: n, tone: "rojo", label: `Venció hace ${dias(-n)}`, escalon: 0 };
  if (n === 0) return { dias: n, tone: "rojo", label: "Vence hoy", escalon: 0 };
  if (n <= 2) return { dias: n, tone: "rojo", label: `Vence en ${dias(n)}`, escalon: 2 };
  if (n <= 7) return { dias: n, tone: "amarillo", label: `Vence en ${dias(n)}`, escalon: n <= 5 ? 5 : 7 };
  return { dias: n, tone: "verde", label: n <= 60 ? `Vigente · vence en ${dias(n)}` : "Vigente", escalon: null };
}

export const SIN_AUTORIZACION: Semaforo = { dias: null, tone: "amarillo", label: "Sin autorización cargada", escalon: null };

/** Cuál es la autorización «vigente» de cada práctica: la de vencimiento más lejano (las anteriores quedaron reemplazadas). */
function ultimasPorPractica<T extends AutorizacionMin>(auths: T[]): T[] {
  const porClave = new Map<string, T>();
  for (const a of auths) {
    if (!a.periodo_hasta) continue;
    const k = `${a.especialidad ?? ""}|${(a.practica ?? "").trim().toLowerCase()}`;
    const prev = porClave.get(k);
    if (!prev || (prev.periodo_hasta ?? "") < a.periodo_hasta) porClave.set(k, a);
  }
  return [...porClave.values()];
}

/** Peor caso entre las autorizaciones de UN paciente (una sola insignia por paciente). */
export function semaforoPaciente(auths: AutorizacionMin[], hoy: string = hoyAR()): Semaforo {
  const vigentes = ultimasPorPractica(auths);
  if (vigentes.length === 0) return SIN_AUTORIZACION;
  let peor = Infinity;
  for (const a of vigentes) peor = Math.min(peor, diasRestantes(a.periodo_hasta as string, hoy));
  return semaforoPorDias(peor);
}

/** Peor caso por paciente para una lista de autorizaciones de varios pacientes. */
export function semaforoPorPaciente(auths: (AutorizacionMin & { patient_id: string | null })[], hoy: string = hoyAR()): Map<string, Semaforo> {
  const porPaciente = new Map<string, AutorizacionMin[]>();
  for (const a of auths) {
    if (!a.patient_id) continue;
    const l = porPaciente.get(a.patient_id) ?? [];
    l.push(a);
    porPaciente.set(a.patient_id, l);
  }
  return new Map([...porPaciente].map(([id, l]) => [id, semaforoPaciente(l, hoy)]));
}

/** Autorizaciones que hay que mirar (vencidas o a 7 días o menos), ya sin las reemplazadas por una más nueva. */
export function autorizacionesPorVencer<T extends AutorizacionMin>(auths: T[], hoy: string = hoyAR()): (T & { semaforo: Semaforo })[] {
  const out: (T & { semaforo: Semaforo })[] = [];
  const porPaciente = new Map<string, T[]>();
  for (const a of auths) {
    const k = a.patient_id ?? "";
    porPaciente.set(k, [...(porPaciente.get(k) ?? []), a]);
  }
  for (const l of porPaciente.values()) {
    for (const a of ultimasPorPractica(l)) {
      const s = semaforoPorDias(diasRestantes(a.periodo_hasta as string, hoy));
      if (s.tone !== "verde") out.push({ ...a, semaforo: s });
    }
  }
  return out.sort((x, y) => (x.semaforo.dias ?? 0) - (y.semaforo.dias ?? 0));
}

export type EstadoAutorizacion = {
  /** Tiene prácticas cargadas y ninguna vigente (de esa especialidad, si se indicó). */
  vencida: boolean;
  /** No hay ninguna autorización cargada (de esa especialidad, si se indicó). */
  sinAutorizacion: boolean;
  /** Días del peor caso (negativo = ya venció). */
  dias: number | null;
  detalle: string;
};

/**
 * ¿La autorización del paciente está vencida? Pensado para avisar (o más adelante bloquear) la carga de
 * evoluciones facturables. Es una consulta con la sesión del usuario (RLS), cacheada por pedido.
 * Hoy NO bloquea nada: la decisión de bloquear está pendiente del cliente (DF-C3 §8).
 */
export const autorizacionVencida = cache(async (patientId: string, especialidad?: string | null): Promise<EstadoAutorizacion> => {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let q = supabase.from("treatment_authorizations").select("patient_id, especialidad, practica, periodo_hasta").eq("patient_id", patientId);
  if (especialidad) q = q.eq("especialidad", especialidad as never);
  const { data } = await q;
  const lista = data ?? [];
  if (lista.length === 0) return { vencida: false, sinAutorizacion: true, dias: null, detalle: "No tiene autorizaciones de práctica cargadas." };
  // De una especialidad: «vencida» = ninguna de sus prácticas está vigente (mejor caso). Del paciente completo: la peor.
  const ult = ultimasPorPractica(lista).map((a) => diasRestantes(a.periodo_hasta as string));
  const s = semaforoPorDias(especialidad ? Math.max(...ult) : Math.min(...ult));
  return { vencida: (s.dias ?? 0) < 0, sinAutorizacion: false, dias: s.dias, detalle: s.label };
});
