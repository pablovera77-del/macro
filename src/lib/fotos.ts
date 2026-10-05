import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Sb = SupabaseClient<Database>;

export const FOTOS_BUCKET = "fotos";

// Las fotos (entrega, retiro, producto) se suben al bucket privado «fotos». En la base se guarda
// la ruta ("fotos/<carpeta>/<archivo>"); los valores viejos eran un link de texto y siguen valiendo.
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function esDataUrlImagen(v: string | null | undefined): v is string {
  return !!v && DATA_URL.test(v);
}

/** Sube una imagen (data URL) y devuelve la ruta que se guarda en la base. */
export async function subirFoto(supabase: Sb, dataUrl: string, carpeta: string): Promise<string> {
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new Error("La foto no se pudo leer. Sacala de nuevo.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 4 * 1024 * 1024) throw new Error("La foto es demasiado pesada. Sacala de nuevo con menos calidad.");
  const path = `${carpeta}/${crypto.randomUUID()}.${EXT[m[1]]}`;
  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, bytes, { contentType: m[1], upsert: false });
  if (error) throw new Error(`No se pudo guardar la foto (${error.message}). Probá de nuevo; si sigue fallando avisá a Administración.`);
  return `${FOTOS_BUCKET}/${path}`;
}

/** Convierte lo guardado (ruta, link o imagen embebida) en algo que el navegador pueda mostrar. */
export async function urlsDeFotos(supabase: Sb, refs: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const rutas: string[] = [];
  for (const r of refs) {
    if (!r) continue;
    if (r.startsWith(`${FOTOS_BUCKET}/`)) rutas.push(r.slice(FOTOS_BUCKET.length + 1));
    else if (/^https?:\/\//.test(r) || r.startsWith("data:image/")) out.set(r, r);
  }
  const unicas = Array.from(new Set(rutas));
  if (unicas.length > 0) {
    const { data } = await supabase.storage.from(FOTOS_BUCKET).createSignedUrls(unicas, 3600);
    for (const d of data ?? []) {
      if (d.path && d.signedUrl) out.set(`${FOTOS_BUCKET}/${d.path}`, d.signedUrl);
    }
  }
  return out;
}
