"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { flash } from "@/lib/flash";
import type { ActionResult } from "@/lib/facturacion";

// C4-15/16: presupuestos de venta a una obra social o a un particular.
// Supuesto: validez simple en días (DF §3.3 deja pendiente validez y conversión a facturación).

type Linea = { descripcion: string; cantidad: number; valor_unitario: number };

function leerLineas(formData: FormData): { lineas: Linea[]; error?: string } {
  const desc = formData.getAll("item_descripcion").map((v) => String(v).trim());
  const cant = formData.getAll("item_cantidad").map((v) => String(v).replace(",", "."));
  const val = formData.getAll("item_valor").map((v) => String(v).replace(",", "."));
  const lineas: Linea[] = [];
  for (let i = 0; i < desc.length; i++) {
    // una línea totalmente vacía se ignora (el formulario siempre deja una fila libre)
    if (!desc[i] && !cant[i] && !val[i]) continue;
    const cantidad = Number(cant[i]);
    const valor_unitario = Number(val[i]);
    if (!desc[i]) return { lineas, error: `A la línea ${i + 1} le falta la descripción.` };
    if (!(cantidad > 0)) return { lineas, error: `La cantidad de la línea ${i + 1} tiene que ser mayor a cero.` };
    if (!(valor_unitario >= 0) || Number.isNaN(valor_unitario)) return { lineas, error: `El valor de la línea ${i + 1} no es un número válido.` };
    lineas.push({ descripcion: desc[i], cantidad, valor_unitario });
  }
  if (lineas.length === 0) return { lineas, error: "Agregá al menos una línea al presupuesto (descripción, cantidad y valor)." };
  return { lineas };
}

export async function saveSalesQuoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración arma presupuestos de venta.");

  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id") || "");
  const destino = String(formData.get("destino") || "obra_social");
  const obra_social_id = destino === "obra_social" ? String(formData.get("obra_social_id") || "") || null : null;
  const particular = destino === "particular" ? String(formData.get("destinatario_particular") || "").trim() : "";
  if (destino === "obra_social" && !obra_social_id) return { error: "Elegí la obra social, o cambiá a «Particular» y escribí el nombre." };
  if (destino === "particular" && !particular) return { error: "Escribí el nombre del particular al que va dirigido el presupuesto." };
  const validez = Number(formData.get("validez_dias") || 15);
  if (!Number.isInteger(validez) || validez < 1 || validez > 365) return { error: "La validez tiene que ser un número de días entre 1 y 365." };
  const notas = String(formData.get("notas") || "").trim() || null;
  const { lineas, error: errLineas } = leerLineas(formData);
  if (errLineas) return { error: errLineas };

  let id = quoteId;
  if (quoteId) {
    const { error } = await supabase
      .from("sales_quotes")
      .update({ obra_social_id, destinatario_particular: particular || null, validez_dias: validez, notas })
      .eq("id", quoteId);
    if (error) return { error: `No se pudo guardar el presupuesto: ${error.message}.` };
    const { error: errDel } = await supabase.from("sales_quote_items").delete().eq("quote_id", quoteId);
    if (errDel) return { error: `No se pudieron actualizar las líneas: ${errDel.message}.` };
  } else {
    const { data, error } = await supabase
      .from("sales_quotes")
      .insert({ obra_social_id, destinatario_particular: particular || null, validez_dias: validez, notas, creado_por: profile.id })
      .select("id")
      .single();
    if (error || !data) return { error: `No se pudo crear el presupuesto: ${error?.message ?? "intentá de nuevo"}.` };
    id = data.id;
  }

  const { error: errItems } = await supabase
    .from("sales_quote_items")
    .insert(lineas.map((l, orden) => ({ quote_id: id, orden, ...l })));
  if (errItems) {
    if (!quoteId) await supabase.from("sales_quotes").delete().eq("id", id);
    return { error: `No se pudieron guardar las líneas: ${errItems.message}.` };
  }

  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${id}`);
  await flash(
    quoteId
      ? "Presupuesto actualizado. Siguiente paso: imprimilo o guardalo como PDF."
      : "Presupuesto creado. Siguiente paso: tocá «Imprimir / guardar PDF» para mandarlo."
  );
  redirect(`/presupuestos/${id}`);
}

export async function deleteSalesQuoteAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") throw new Error("Solo Administración arma presupuestos de venta.");
  const id = String(formData.get("quote_id") || "");
  if (!id) throw new Error("Falta el presupuesto. Recargá la página.");
  const supabase = await createClient();
  const { error } = await supabase.from("sales_quotes").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar el presupuesto: ${error.message}.`);
  revalidatePath("/presupuestos");
  await flash("Presupuesto borrado.");
  redirect("/presupuestos");
}
