import { TZ } from "@/lib/plan";

/** Fecha y hora en horario de San Juan, para mostrar. */
export function fechaHora(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-AR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
}

export function fechaCorta(v: string | null | undefined): string {
  if (!v) return "—";
  // Las fechas sueltas (AAAA-MM-DD) no se corren de día por la zona horaria.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00-03:00`) : new Date(v);
  return d.toLocaleDateString("es-AR", { timeZone: TZ });
}

/** Link para abrir el domicilio en el mapa del celular (Google Maps). */
export function mapaUrl(direccion: string | null | undefined, lat?: number | null, lng?: number | null): string | null {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (!direccion) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, San Juan, Argentina`)}`;
}

/** Link para llamar por teléfono. */
export function telUrl(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const limpio = tel.replace(/[^\d+]/g, "");
  return limpio ? `tel:${limpio}` : null;
}

export function pesos(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
