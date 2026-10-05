import { TZ, ymdAR } from "@/lib/plan";

// Horario de una visita (C2 R08, R09): hora exacta, solo el día, franja o rango.
//
// Cómo se guarda (ver supabase/migrations/20261005_w1b_agenda_visitas.sql):
//  - La fecha de la visita (`fecha_programada`) siempre existe y es el INICIO del tramo:
//      hora exacta -> esa hora; solo el día -> 00:00; franja -> inicio de la franja; rango -> hora desde.
//  - Así el orden y los filtros por día siguen funcionando igual que con las visitas viejas.
//  - `sin_hora`, `franja`, `hora_desde` y `hora_hasta` dicen de qué tipo es el horario.
//    Las visitas existentes (sin_hora=false y sin franja ni rango) son de hora exacta.

export type Franja = "manana" | "tarde" | "noche";
export type TipoHorario = "exacta" | "sin_hora" | "franja" | "rango";

// Supuesto a validar con el cliente: 8 a 14, 16 a 21 y noche desde las 21 (el documento
// funcional habla de «mañana/tarde, 8-14 / 16-21»; la noche la sumamos para guardias y cuidadores).
export const FRANJAS: Record<Franja, { label: string; desde: string; hasta: string; resumen: string; frase: string }> = {
  manana: { label: "Mañana", desde: "08:00", hasta: "14:00", resumen: "de 8 a 14 hs", frase: "por la mañana" },
  tarde: { label: "Tarde", desde: "16:00", hasta: "21:00", resumen: "de 16 a 21 hs", frase: "por la tarde" },
  noche: { label: "Noche", desde: "21:00", hasta: "23:59", resumen: "desde las 21 hs", frase: "por la noche" },
};

export type HorarioVisita = {
  fecha_programada: string;
  sin_hora?: boolean | null;
  franja?: string | null;
  hora_desde?: string | null;
  hora_hasta?: string | null;
};

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function tipoHorario(v: HorarioVisita): TipoHorario {
  if (v.sin_hora) return "sin_hora";
  if (v.franja && v.franja in FRANJAS) return "franja";
  if (v.hora_desde && v.hora_hasta) return "rango";
  return "exacta";
}

/** Instante a partir de un día (AAAA-MM-DD) y una hora (HH:mm) de San Juan (UTC-3 todo el año). */
export function instanteSanJuan(ymd: string, hora = "00:00"): Date {
  return new Date(`${ymd}T${hora}:00-03:00`);
}

export function horaAR(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** «14:30 hs», «Mañana (de 8 a 14 hs)», «De 09:00 a 12:00 hs» o «Sin hora definida». */
export function descripcionHorario(v: HorarioVisita): string {
  switch (tipoHorario(v)) {
    case "sin_hora":
      return "Sin hora definida";
    case "franja": {
      const f = FRANJAS[v.franja as Franja];
      return `${f.label} (${f.resumen})`;
    }
    case "rango":
      return `De ${hhmm(v.hora_desde)} a ${hhmm(v.hora_hasta)} hs`;
    default:
      return `${horaAR(v.fecha_programada)} hs`;
  }
}

/** Fecha corta en hora de San Juan: «mié, 07 oct». */
export function descripcionDia(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" });
}

/** «mié, 07 oct · 14:30 hs» (para listas donde se muestra todo junto). */
export function descripcionFechaHora(v: HorarioVisita): string {
  return `${descripcionDia(v.fecha_programada)} · ${descripcionHorario(v)}`;
}

/** Último instante en que la visita todavía está «a tiempo» (para decidir si está atrasada). */
export function finDeVisita(v: HorarioVisita): Date {
  const ymd = ymdAR(v.fecha_programada);
  switch (tipoHorario(v)) {
    case "sin_hora": {
      const [y, m, d] = ymd.split("-").map(Number);
      return instanteSanJuan(new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10));
    }
    case "franja":
      return instanteSanJuan(ymd, FRANJAS[v.franja as Franja].hasta);
    case "rango":
      return instanteSanJuan(ymd, hhmm(v.hora_hasta));
    default:
      return new Date(v.fecha_programada);
  }
}

export function estaAtrasada(v: HorarioVisita, ahora = new Date()): boolean {
  return finDeVisita(v).getTime() < ahora.getTime();
}

/** Frase para el recordatorio de WhatsApp: «mañana por la tarde», «el viernes 9 de octubre a las 10:30 hs», etc. */
export function fraseCuando(v: HorarioVisita, ahora = new Date()): string {
  const dia = new Date(v.fecha_programada).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const maniana = new Date(ahora.getTime() + 86400000);
  const esManiana = ymdAR(v.fecha_programada) === ymdAR(maniana);
  const cuando = esManiana ? "mañana" : `el ${dia}`;
  switch (tipoHorario(v)) {
    case "sin_hora":
      return `${cuando} (el horario exacto se lo confirmamos antes)`;
    case "franja":
      return `${cuando} ${FRANJAS[v.franja as Franja].frase}`;
    case "rango":
      return `${cuando} entre las ${hhmm(v.hora_desde)} y las ${hhmm(v.hora_hasta)} hs`;
    default:
      return `el ${dia} a las ${horaAR(v.fecha_programada)} hs`;
  }
}

export type HorarioForm = {
  fecha_programada: string; // ISO
  sin_hora: boolean;
  franja: Franja | null;
  hora_desde: string | null;
  hora_hasta: string | null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Arma los datos de horario a partir de lo que manda el formulario (día + tipo de horario).
 * También acepta el formato viejo (`fecha_programada` como datetime-local) para no romper
 * formularios guardados en pestañas abiertas.
 */
export function leerHorarioDeForm(fd: FormData, prefijo = ""): HorarioForm | { error: string } {
  const get = (k: string) => String(fd.get(`${prefijo}${k}`) ?? "").trim();
  const tipo = (get("horario_tipo") || "exacta") as TipoHorario;
  let fecha = get("fecha");
  let hora = get("hora");
  if (!fecha) {
    // Formato viejo: «2026-10-07T14:30».
    const viejo = get("fecha_programada");
    if (viejo.includes("T")) [fecha, hora] = viejo.split("T");
  }
  if (!YMD.test(fecha)) return { error: "Elegí el día de la visita." };
  if (Number.isNaN(instanteSanJuan(fecha).getTime())) return { error: "El día elegido no es válido." };

  if (tipo === "sin_hora") {
    return { fecha_programada: instanteSanJuan(fecha).toISOString(), sin_hora: true, franja: null, hora_desde: null, hora_hasta: null };
  }
  if (tipo === "franja") {
    const f = get("franja") as Franja;
    if (!(f in FRANJAS)) return { error: "Elegí la franja: mañana, tarde o noche." };
    return { fecha_programada: instanteSanJuan(fecha, FRANJAS[f].desde).toISOString(), sin_hora: false, franja: f, hora_desde: null, hora_hasta: null };
  }
  if (tipo === "rango") {
    const desde = get("hora_desde");
    const hasta = get("hora_hasta");
    if (!HM.test(desde) || !HM.test(hasta)) return { error: "Completá la hora «desde» y la hora «hasta» del rango." };
    if (hasta <= desde) return { error: "La hora «hasta» tiene que ser posterior a la hora «desde»." };
    return { fecha_programada: instanteSanJuan(fecha, desde).toISOString(), sin_hora: false, franja: null, hora_desde: desde, hora_hasta: hasta };
  }
  if (!HM.test(hora)) return { error: "Completá la hora de la visita (o elegí «Sin hora definida», una franja o un rango)." };
  return { fecha_programada: instanteSanJuan(fecha, hora).toISOString(), sin_hora: false, franja: null, hora_desde: null, hora_hasta: null };
}

/**
 * Visitas de un mismo profesional con la misma hora exacta (R52). Solo se comparan las de hora
 * exacta que siguen vivas (programada o confirmada): las franjas y rangos no se pisan «a la fuerza».
 * Devuelve los ids de las visitas que chocan con otra.
 */
export function visitasEnConflicto(visitas: (HorarioVisita & { id: string; profesional_id: string; estado: string })[]): Set<string> {
  const vistos = new Map<string, string[]>();
  for (const v of visitas) {
    if (v.estado !== "programada" && v.estado !== "confirmada") continue;
    if (tipoHorario(v) !== "exacta") continue;
    const k = `${v.profesional_id}|${new Date(v.fecha_programada).getTime()}`;
    vistos.set(k, [...(vistos.get(k) ?? []), v.id]);
  }
  const out = new Set<string>();
  for (const ids of vistos.values()) if (ids.length > 1) ids.forEach((i) => out.add(i));
  return out;
}
