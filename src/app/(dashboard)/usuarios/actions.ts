"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { ROLES_ASIGNABLES, passwordProvisoria } from "@/lib/usuarios";
import { esCupo } from "@/lib/cupos";
import type { AppRole } from "@/lib/roles";
import type { Enums } from "@/types/database";
import { TIPO_PROFESIONAL_POR_CODIGO, TIPOS_DOCUMENTO_LEGAJO, TIPOS_ARCHIVO_LEGAJO, MAX_BYTES_DOCUMENTO, normalizarCuil } from "@/lib/legajo-personal";

export type UsuarioResult = { error?: string; creado?: { email: string; password: string; nombre: string } } | null;
const fail = (error: string): UsuarioResult => ({ error });

const SOLO_ADMIN = "Solo Administración gestiona los usuarios.";

async function soloAdmin() {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") return null;
  return profile;
}

const esRolValido = (r: string): r is AppRole => (ROLES_ASIGNABLES as string[]).includes(r);
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// DF-C1 §3 (R17, R21): alta de personal. Crea la cuenta de acceso y el legajo; la contraseña provisoria
// se muestra una sola vez a quien la crea y la persona la cambia con «Olvidé mi contraseña».
export async function crearUsuarioAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);

  const nombre = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const rol = String(formData.get("role") || "");
  const especialidad = String(formData.get("especialidad") || "") || null;
  if (!nombre) return fail("Falta el nombre y apellido.");
  if (!emailValido(email)) return fail("El email no es válido.");
  if (!esRolValido(rol)) return fail("Elegí un rol de la lista.");
  if (rol === "profesional_asistencial" && !especialidad) return fail("Para un profesional asistencial elegí su disciplina.");

  const admin = createAdminClient();
  if (!admin) {
    return fail("Todavía no está activada la creación de usuarios desde la pantalla: falta cargar la clave de servicio en Vercel (SUPABASE_SERVICE_ROLE_KEY). Mientras tanto, las altas se hacen en Supabase.");
  }

  const password = passwordProvisoria();
  const { data: creada, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombre },
  });
  if (errAuth || !creada.user) {
    return fail(
      errAuth?.message?.toLowerCase().includes("already")
        ? "Ya existe una cuenta con ese email."
        : "No se pudo crear la cuenta. Probá de nuevo en unos minutos."
    );
  }

  const { error: errPerfil } = await admin.from("profiles").insert({
    id: creada.user.id,
    full_name: nombre,
    role: rol as Enums<"app_role">,
    active: true,
    especialidad: (especialidad as Enums<"specialty"> | null) ?? null,
    dni: String(formData.get("dni") || "").trim() || null,
    matricula: String(formData.get("matricula") || "").trim() || null,
    telefono: String(formData.get("telefono") || "").trim() || null,
    email_contacto: email,
    fecha_ingreso: String(formData.get("fecha_ingreso") || "") || null,
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(creada.user.id);
    return fail("No se pudo guardar el legajo, así que no se creó la cuenta. Probá de nuevo.");
  }

  revalidatePath("/usuarios");
  await flash(`Usuario creado: ${nombre}.`);
  return { creado: { email, password, nombre } };
}

export async function cambiarRolAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  const rol = String(formData.get("role") || "");
  if (!id || !esRolValido(rol)) return fail("Elegí un rol de la lista.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_id: id, p_role: rol as Enums<"app_role"> });
  if (error) return fail(error.message);
  revalidatePath("/usuarios");
  await flash("Rol actualizado. Rige desde el próximo ingreso de esa persona.");
  return null;
}

export async function activarUsuarioAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  const activo = String(formData.get("activo") || "") === "1";
  if (!id) return fail("Falta la persona.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_active", { p_id: id, p_active: activo });
  if (error) return fail(error.message);
  revalidatePath("/usuarios");
  await flash(activo ? "Cuenta reactivada." : "Cuenta desactivada: ya no puede ingresar. Su historial se conserva.");
  return null;
}

export async function guardarLegajoAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  const nombre = String(formData.get("full_name") || "").trim();
  if (!id) return fail("Falta la persona.");
  if (!nombre) return fail("Falta el nombre y apellido.");
  let esp = String(formData.get("especialidad") || "") || null;
  const email = String(formData.get("email_contacto") || "").trim();
  if (email && !emailValido(email)) return fail("El email de contacto no es válido.");
  const cuilTxt = String(formData.get("cuil") || "").trim();
  const cuil = cuilTxt ? normalizarCuil(cuilTxt) : "";
  if (cuil === null) return fail("El CUIL tiene que tener 11 números (por ejemplo 20-12345678-9).");
  const tipo = String(formData.get("tipo_profesional") || "");
  if (tipo && !TIPO_PROFESIONAL_POR_CODIGO[tipo]) return fail("Elegí el tipo de profesional de la lista.");
  const tipoOtro = String(formData.get("tipo_profesional_otro") || "").trim();
  if (tipo === "otros" && !tipoOtro) return fail("Si elegís «Otros», escribí qué práctica realiza.");
  // La disciplina clínica se completa sola desde el tipo de profesional si no se eligió una.
  if (tipo && !esp) esp = TIPO_PROFESIONAL_POR_CODIGO[tipo].esp;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_legajo_v2", {
    p_id: id,
    p_full_name: nombre,
    p_especialidad: (esp as Enums<"specialty"> | null) as Enums<"specialty">,
    p_dni: String(formData.get("dni") || ""),
    p_matricula: String(formData.get("matricula") || ""),
    p_telefono: String(formData.get("telefono") || ""),
    p_email_contacto: email,
    p_fecha_ingreso: (String(formData.get("fecha_ingreso") || "") || null) as string,
    p_fecha_baja: (String(formData.get("fecha_baja") || "") || null) as string,
    p_fecha_nacimiento: (String(formData.get("fecha_nacimiento") || "") || null) as string,
    p_domicilio: String(formData.get("domicilio") || ""),
    p_cuil: cuil ?? "",
    p_tipo_profesional: tipo,
    p_tipo_profesional_otro: tipo === "otros" ? tipoOtro : "",
  });
  if (error) return fail(error.message);
  revalidatePath("/usuarios");
  await flash("Legajo guardado.");
  return null;
}

// Documentación adjunta al legajo (DNI, título, matrícula, vacunación, mala praxis). Va a un bucket privado.
export async function subirDocumentoLegajoAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);
  const profile_id = String(formData.get("id") || "");
  const tipo = String(formData.get("tipo") || "");
  const vence = String(formData.get("vence") || "") || null;
  const archivo = formData.get("archivo");
  if (!profile_id) return fail("Falta la persona.");
  if (!TIPOS_DOCUMENTO_LEGAJO[tipo]) return fail("Elegí qué documento es.");
  if (!(archivo instanceof File) || archivo.size === 0) return fail("Elegí el archivo a subir.");
  const ext = TIPOS_ARCHIVO_LEGAJO[archivo.type];
  if (!ext) return fail("El archivo tiene que ser un PDF o una imagen (JPG, PNG).");
  if (archivo.size > MAX_BYTES_DOCUMENTO) return fail("El archivo pesa más de 5 MB. Comprimilo o sacale una foto con menos calidad.");

  const supabase = await createClient();
  const ruta = `${profile_id}/${crypto.randomUUID()}.${ext}`;
  const { error: eUp } = await supabase.storage.from("legajos").upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, upsert: false });
  if (eUp) return fail(`No se pudo subir el archivo (${eUp.message}). Probá de nuevo.`);
  const { error } = await supabase.from("profile_documents").insert({
    profile_id,
    tipo,
    archivo: ruta,
    nombre_original: archivo.name.slice(0, 200),
    vence,
    subido_por: yo.id,
  });
  if (error) {
    await supabase.storage.from("legajos").remove([ruta]);
    return fail("No se pudo registrar el documento. Probá de nuevo.");
  }
  revalidatePath("/usuarios");
  await flash("Documento agregado al legajo.");
  return null;
}

export async function eliminarDocumentoLegajoAction(formData: FormData) {
  const yo = await soloAdmin();
  if (!yo) throw new Error(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Falta el documento.");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("profile_documents").select("archivo").eq("id", id).maybeSingle();
  if (!doc) throw new Error("No encontramos el documento.");
  const { error } = await supabase.from("profile_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.storage.from("legajos").remove([doc.archivo]);
  revalidatePath("/usuarios");
  await flash("Documento quitado del legajo.");
}

// Firma y sello digital de la persona (hoy se usa en el pie de los PDF de la coordinación).
export async function guardarFirmaSelloAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  const quitar = String(formData.get("quitar") || "") === "1";
  const archivo = formData.get("archivo");
  if (!id) return fail("Falta la persona.");
  let dataUrl: string | null = null;
  if (!quitar) {
    if (!(archivo instanceof File) || archivo.size === 0) return fail("Elegí la imagen de la firma y el sello.");
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) return fail("La imagen tiene que ser PNG o JPG.");
    if (archivo.size > 200 * 1024) return fail("La imagen pesa más de 200 KB. Recortala o reducila.");
    dataUrl = `data:${archivo.type};base64,${Buffer.from(await archivo.arrayBuffer()).toString("base64")}`;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_firma_sello", { p_id: id, p_firma: dataUrl as string });
  if (error) return fail(error.message);
  revalidatePath("/usuarios");
  await flash(quitar ? "Firma y sello quitados." : "Firma y sello guardados.");
  return null;
}

// H11: cupo contratado del profesional (enfermería, kinesiología). Es una guía para Coordinación.
export async function guardarCupoAction(_prev: UsuarioResult, formData: FormData): Promise<UsuarioResult> {
  const yo = await soloAdmin();
  if (!yo) return fail(SOLO_ADMIN);
  const id = String(formData.get("id") || "");
  const cupo = String(formData.get("cupo") || "");
  if (!id) return fail("Falta la persona.");
  if (cupo && !esCupo(cupo)) return fail("Elegí un cupo de la lista.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_cupo", { p_id: id, p_cupo: cupo });
  if (error) return fail(error.message);
  revalidatePath("/usuarios");
  revalidatePath("/productividad");
  await flash(cupo ? "Cupo guardado." : "Cupo quitado.");
  return null;
}
