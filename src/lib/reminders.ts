import { TZ } from "@/lib/plan";
import { fraseCuando, type HorarioVisita } from "@/lib/horario";

// G4: recordatorios de visita por WhatsApp, siempre manuales. La app solo arma el
// link con el mensaje escrito; una persona lo revisa y toca "Enviar" en WhatsApp.

/** Número para wa.me (solo dígitos, con 54 adelante). Devuelve null si no alcanza. */
export function telefonoWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length < 8) return null;
  if (d.startsWith("54")) return d;
  d = d.replace(/^0+/, "");
  // Celular argentino: 54 9 + área + número (sin el 15).
  return `549${d}`;
}

/** Rango [desde, hasta) del día de mañana en San Juan, como ISO UTC. */
export function rangoManiana(ahora = new Date()): { desde: string; hasta: string; etiqueta: string } {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ahora);
  const [y, m, d] = ymd.split("-").map(Number);
  const iso = (dia: number) => `${new Date(Date.UTC(y, m - 1, dia)).toISOString().slice(0, 10)}T00:00:00-03:00`;
  const desde = new Date(iso(d + 1));
  const hasta = new Date(iso(d + 2));
  const etiqueta = desde.toLocaleDateString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  return { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta };
}

export function mensajeRecordatorio(opts: {
  paciente: string;
  disciplina: string;
  fechaIso: string;
  profesional?: string | null;
  /** Franja, rango o «sin hora»: si no viene, se usa la hora exacta de fechaIso. */
  horario?: Omit<HorarioVisita, "fecha_programada">;
  ahora?: Date;
}): string {
  const cuando = fraseCuando({ fecha_programada: opts.fechaIso, ...opts.horario }, opts.ahora);
  const quien = opts.profesional ? ` con ${opts.profesional}` : "";
  return `Hola, le escribimos de Profesionales SRL. Le recordamos la visita de ${opts.disciplina.toLowerCase()}${quien} a ${opts.paciente} ${cuando}. Si necesita reprogramarla, por favor respóndanos este mensaje.`;
}

export function linkWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  const n = telefonoWhatsapp(telefono);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : null;
}
