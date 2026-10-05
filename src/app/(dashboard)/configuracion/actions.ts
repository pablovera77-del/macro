"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import type { ActionResult } from "@/lib/facturacion";
import type { Enums } from "@/types/database";

const fail = (error: string): ActionResult => ({ error });
const SOLO_ADMIN = "Solo Administración configura la plataforma.";

async function soloAdmin() {
  const { profile } = await requireProfile();
  return profile.role === "administracion" ? profile : null;
}

function refrescar() {
  revalidatePath("/configuracion");
  revalidatePath("/productividad");
  revalidatePath("/agenda");
  revalidatePath("/internacion");
}

// DF-C1 §4.2 (R78): parámetros numéricos editables sin tocar código.
export async function guardarParametroAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await soloAdmin())) return fail(SOLO_ADMIN);
  const clave = String(formData.get("clave") || "");
  const valor = Number(String(formData.get("valor") || "").replace(",", "."));
  if (!clave) return fail("Falta el parámetro.");
  if (!Number.isFinite(valor) || valor < 0) return fail("Poné un número igual o mayor que cero.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").update({ valor }).eq("clave", clave).select("clave");
  if (error) return fail(`No se pudo guardar: ${error.message}`);
  if (!data?.length) return fail("No encontramos ese parámetro.");
  refrescar();
  await flash("Parámetro guardado. Rige desde ahora.");
  return null;
}

// DF-C1 §4.2 (R42-R48): catálogos editables. Se desactiva en vez de borrar para no romper datos viejos.
export async function guardarItemCatalogoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await soloAdmin())) return fail(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const activo = String(formData.get("activo") || "") === "1";
  if (!id) return fail("Falta el elemento.");
  if (!nombre) return fail("El nombre no puede quedar vacío.");
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update({ nombre, activo }).eq("id", id);
  if (error) return fail(`No se pudo guardar: ${error.message}`);
  refrescar();
  await flash(activo ? "Elemento guardado." : "Elemento guardado y oculto de las listas.");
  return null;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export async function agregarItemCatalogoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await soloAdmin())) return fail(SOLO_ADMIN);
  const catalogo = String(formData.get("catalogo") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  if (!catalogo) return fail("Falta el catálogo.");
  if (!nombre) return fail("Escribí el nombre del elemento nuevo.");
  const codigo = slug(nombre);
  if (!codigo) return fail("El nombre tiene que incluir letras o números.");
  const supabase = await createClient();
  const { data: ultimo } = await supabase.from("catalog_items").select("orden").eq("catalogo", catalogo).order("orden", { ascending: false }).limit(1);
  const orden = (ultimo?.[0]?.orden ?? 0) + 1;
  const { error } = await supabase.from("catalog_items").insert({ catalogo, codigo, nombre, orden });
  if (error) return fail(error.code === "23505" ? "Ya existe un elemento con ese nombre en este catálogo." : `No se pudo agregar: ${error.message}`);
  refrescar();
  await flash("Elemento agregado.");
  return null;
}

// DF-C1 §4.2 (R50-R54): catálogo de alertas — texto, a quién le llega y por qué canal.
// El envío real por mail o WhatsApp todavía no está conectado: esos canales quedan como configuración.
export async function guardarAlertaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await soloAdmin())) return fail(SOLO_ADMIN);
  const codigo = String(formData.get("codigo") || "");
  const mensaje = String(formData.get("mensaje") || "").trim();
  if (!codigo) return fail("Falta la alerta.");
  if (!mensaje) return fail("El texto del aviso no puede quedar vacío.");
  const roles = formData.getAll("roles").map(String);

  const supabase = await createClient();
  const { error } = await supabase
    .from("alert_types")
    .update({
      mensaje,
      activo: formData.get("activo") === "on",
      canal_app: formData.get("canal_app") === "on",
      canal_email: formData.get("canal_email") === "on",
      canal_whatsapp: formData.get("canal_whatsapp") === "on",
    })
    .eq("codigo", codigo);
  if (error) return fail(`No se pudo guardar: ${error.message}`);

  // Destinatarios por rol: se reemplazan los roles (los destinatarios por persona no se tocan).
  const { error: errDel } = await supabase.from("alert_type_recipients").delete().eq("alert_type", codigo).not("role", "is", null);
  if (errDel) return fail(`No se pudieron actualizar los destinatarios: ${errDel.message}`);
  if (roles.length) {
    const { error: errIns } = await supabase
      .from("alert_type_recipients")
      .insert(roles.map((role) => ({ alert_type: codigo, role: role as Enums<"app_role"> })));
    if (errIns) return fail(`No se pudieron guardar los destinatarios: ${errIns.message}`);
  }
  refrescar();
  await flash("Alerta guardada.");
  return null;
}
