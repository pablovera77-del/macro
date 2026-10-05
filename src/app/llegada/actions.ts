"use server";

import { createClient } from "@/lib/supabase/server";

// Acción pública (sin sesión) de la página /llegada/<token>: la familia confirma que el paciente llegó al
// domicilio (DF-C3 §12). El link se valida dentro de la base: vence a las 48 h y se usa una sola vez.
export type LlegadaResultado = { ok: boolean; ya?: boolean; error?: "invalido" | "vencido" | "error" };

export async function confirmarLlegadaFamiliaAction(token: string): Promise<LlegadaResultado> {
  if (!/^[0-9a-f]{20,64}$/.test(token)) return { ok: false, error: "invalido" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_arrival_confirm", { p_token: token });
  if (error || !data) return { ok: false, error: "error" };
  const r = data as { ok: boolean; ya_confirmado?: boolean; error?: string };
  if (!r.ok) return { ok: false, error: r.error === "vencido" ? "vencido" : "invalido" };
  return { ok: true, ya: !!r.ya_confirmado };
}
