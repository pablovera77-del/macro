"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { flash } from "@/lib/flash";
import { PRACTICA_POR_CODIGO } from "@/lib/autorizaciones";
import type { ActionState } from "@/lib/stock-types";

// H9 (Vanina 06/10): Dirección carga lo que cuesta cada prestación (honorarios). Facturación lo usa para calcular
// el costo y la rentabilidad de los presupuestos. Pendiente de confirmar con Vanina si es por tipo de prestación o por profesional.
export async function guardarHonorariosAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  if (profile.role !== "direccion") return { error: "Solo Dirección carga los honorarios." };
  const supabase = await createClient();
  const filas: { practica_tipo: string; costo_unitario: number; updated_by: string; updated_at: string }[] = [];
  for (const codigo of Object.keys(PRACTICA_POR_CODIGO)) {
    const raw = String(formData.get(`costo_${codigo}`) || "").replace(",", ".").trim();
    if (!raw) continue;
    const costo = Number(raw);
    if (!(costo >= 0) || Number.isNaN(costo)) return { error: `El costo de «${PRACTICA_POR_CODIGO[codigo].label}» no es un número válido.` };
    filas.push({ practica_tipo: codigo, costo_unitario: costo, updated_by: profile.id, updated_at: new Date().toISOString() });
  }
  if (filas.length === 0) return { error: "Cargá el costo de al menos una prestación." };
  const { error } = await supabase.from("honorarios_prestacion").upsert(filas, { onConflict: "practica_tipo" });
  if (error) return { error: `No se pudieron guardar los honorarios: ${error.message}` };
  revalidatePath("/honorarios");
  revalidatePath("/presupuestos");
  await flash(`Honorarios guardados (${filas.length} prestación${filas.length === 1 ? "" : "es"}). Facturación ya los usa en los presupuestos.`);
  return { error: null };
}
