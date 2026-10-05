"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { flash } from "@/lib/flash";
import { ROLES_ASIGNABLES, passwordProvisoria } from "@/lib/usuarios";
import type { AppRole } from "@/lib/roles";
import type { Enums } from "@/types/database";

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
  const esp = String(formData.get("especialidad") || "") || null;
  const email = String(formData.get("email_contacto") || "").trim();
  if (email && !emailValido(email)) return fail("El email de contacto no es válido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_legajo", {
    p_id: id,
    p_full_name: nombre,
    p_especialidad: (esp as Enums<"specialty"> | null) as Enums<"specialty">,
    p_dni: String(formData.get("dni") || ""),
    p_matricula: String(formData.get("matricula") || ""),
    p_telefono: String(formData.get("telefono") || ""),
    p_email_contacto: email,
    p_fecha_ingreso: (String(formData.get("fecha_ingreso") || "") || null) as string,
    p_fecha_baja: (String(formData.get("fecha_baja") || "") || null) as string,
  });
  if (error) return fail(error.message);
  revalidatePath("/usuarios");
  await flash("Legajo guardado.");
  return null;
}
