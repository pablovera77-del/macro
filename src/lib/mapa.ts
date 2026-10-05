/** Enlace de Google Maps para un domicilio (se agrega «San Juan, Argentina» si el domicilio no lo trae). */
export function urlMapa(domicilio: string): string {
  const q = /san juan/i.test(domicilio) ? domicilio : `${domicilio}, San Juan, Argentina`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Número para un enlace `tel:` (solo dígitos y +). */
export function telHref(raw: string | null | undefined): string | null {
  const t = raw?.replace(/[^\d+]/g, "");
  return t && t.replace(/\D/g, "").length >= 6 ? `tel:${t}` : null;
}

/** «35 min» o «1 h 10 min» entre dos instantes. */
export function duracion(desdeIso: string, hastaIso: string | Date): string {
  const min = Math.max(0, Math.round((new Date(hastaIso).getTime() - new Date(desdeIso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
