"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/facturacion";

// Cada persona marca como leídos solo sus propios avisos (la base lo garantiza: política por usuario).
export async function marcarLeidaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
  if (id) q = q.eq("id", id);
  const { error } = await q;
  if (error) return { error: "No se pudo marcar como leído. Probá de nuevo." };
  revalidatePath("/notificaciones");
  revalidatePath("/inicio");
  return null;
}
