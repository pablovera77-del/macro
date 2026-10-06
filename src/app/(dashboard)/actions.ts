"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PatientHit = { id: string; nombre_completo: string; dni: string | null; estado: string };

// Buscador global (B2): devuelve solo pacientes que el rol puede ver (RLS) y
// únicamente para los roles que pueden abrir la ficha del paciente.
export async function searchPatientsAction(query: string): Promise<PatientHit[]> {
  const q = query.trim().replace(/[%,()]/g, " ").trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || !["administracion", "coordinador_internacion", "profesional_asistencial", "facturacion"].includes(profile.role)) return [];
  const digits = q.replace(/\D/g, "");
  const filters = [`nombre_completo.ilike.%${q}%`];
  if (digits.length >= 2) filters.push(`dni.ilike.%${digits}%`);
  const { data } = await supabase
    .from("patients")
    .select("id, nombre_completo, dni, estado")
    .or(filters.join(","))
    .order("nombre_completo")
    .limit(8);
  return (data ?? []) as PatientHit[];
}
