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

// H13/H14 · Sin clave de Google Maps: solo enlaces. Se muestran la ubicación capturada y rutas sugeridas.

/** Enlace a un punto (latitud y longitud capturadas por el celular). */
export function urlPunto(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export type PuntoRuta = { lat: number | null; lng: number | null; domicilio: string | null };

const texto = (p: PuntoRuta) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.domicilio ? (/san juan/i.test(p.domicilio) ? p.domicilio : `${p.domicilio}, San Juan, Argentina`) : "");

/** Ruta de Google Maps con paradas en el orden dado (hasta 9 paradas intermedias). */
export function urlRuta(puntos: PuntoRuta[]): string | null {
  const v = puntos.map(texto).filter(Boolean);
  if (v.length === 0) return null;
  const destino = v[v.length - 1];
  const medio = v.slice(0, -1).slice(0, 9);
  const q = new URLSearchParams({ api: "1", destination: destino, travelmode: "driving" });
  if (medio.length) q.set("waypoints", medio.join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Orden sugerido por cercanía (vecino más cercano). Los puntos sin ubicación capturada quedan al final en su orden. */
export function ordenarPorCercania<T extends { lat: number | null; lng: number | null }>(items: T[]): T[] {
  const con = items.filter((i): i is T & { lat: number; lng: number } => i.lat != null && i.lng != null);
  const sin = items.filter((i) => i.lat == null || i.lng == null);
  const out: (T & { lat: number; lng: number })[] = [];
  const resto = [...con];
  let actual = resto.shift();
  while (actual) {
    out.push(actual);
    if (resto.length === 0) break;
    let mejor = 0;
    for (let i = 1; i < resto.length; i++) if (km(actual, resto[i]) < km(actual, resto[mejor])) mejor = i;
    [actual] = resto.splice(mejor, 1);
  }
  return [...out, ...sin];
}
