import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Enums } from "@/types/database";

export type AppRole = Enums<"app_role">;

export async function requireProfile() {
const supabase = await createClient();
const {
data: { user },
} = await supabase.auth.getUser();

if (!user) {
redirect("/login");
}

const { data: profile } = await supabase
.from("profiles")
.select("id, full_name, role, active")
.eq("id", user.id)
.single();

if (!profile || !profile.active) {
redirect("/login?error=cuenta_inactiva");
}

return { user, profile };
}

export const ROLE_LABELS: Record<AppRole, string> = {
deposito: "Depósito",
administracion: "Administración",
transporte: "Transporte",
direccion: "Dirección",
coordinador_internacion: "Coordinador de Internación",
profesional_asistencial: "Profesional Asistencial",
medico_coordinador: "Médico Coordinador",
};

export type NavIconId =
| "catalogo"
| "pedidos"
| "seguimiento"
| "pacientes"
| "dashboard"
| "internacion"
| "agenda"
| "evoluciones"
| "obras_sociales"
| "facturacion"
| "compras";

export const NAV_BY_ROLE: Record<AppRole, { href: string; label: string; icon: NavIconId; description: string }[]> = {
deposito: [
{ href: "/catalogo", label: "Catálogo", icon: "catalogo", description: "Insumos y equipos" },
{ href: "/pedidos", label: "Pedidos", icon: "pedidos", description: "Entregas a domicilio" },
{ href: "/seguimiento", label: "Seguimiento", icon: "seguimiento", description: "Equipos en tránsito" },
{ href: "/compras", label: "Compras", icon: "compras", description: "Proyección y cotizaciones" },
],
administracion: [
{ href: "/pacientes", label: "Autorizaciones", icon: "pacientes", description: "Stock por paciente" },
{ href: "/pedidos", label: "Pedidos", icon: "pedidos", description: "Entregas a domicilio" },
{ href: "/seguimiento", label: "Seguimiento", icon: "seguimiento", description: "Equipos en tránsito" },
{ href: "/compras", label: "Compras", icon: "compras", description: "Proyección y cotizaciones" },
{ href: "/obras-sociales", label: "Obras sociales", icon: "obras_sociales", description: "Catálogo y valores" },
{ href: "/facturacion", label: "Facturación", icon: "facturacion", description: "Cierre mensual y débitos" },
],
transporte: [
{ href: "/pedidos", label: "Pedidos", icon: "pedidos", description: "Entregas a domicilio" },
{ href: "/seguimiento", label: "Seguimiento", icon: "seguimiento", description: "Equipos en tránsito" },
],
direccion: [{ href: "/dashboard", label: "Dashboard ejecutivo", icon: "dashboard", description: "Vista en tiempo real" }],
coordinador_internacion: [
{ href: "/internacion", label: "Pacientes", icon: "internacion", description: "Admisión, legajo y egresos" },
{ href: "/agenda", label: "Agenda", icon: "agenda", description: "Visitas domiciliarias" },
],
profesional_asistencial: [
{ href: "/agenda", label: "Mi agenda", icon: "agenda", description: "Visitas asignadas" },
{ href: "/evoluciones", label: "Historia clínica", icon: "evoluciones", description: "Evoluciones por disciplina" },
{ href: "/internacion", label: "Mis pacientes", icon: "internacion", description: "Informar egreso" },
],
medico_coordinador: [
{ href: "/internacion", label: "Pacientes", icon: "internacion", description: "Admisión, legajo y egresos" },
{ href: "/agenda", label: "Agenda", icon: "agenda", description: "Visitas domiciliarias" },
{ href: "/evoluciones", label: "Historia clínica", icon: "evoluciones", description: "Evoluciones por disciplina" },
],
};

export const ROLE_ACCENT: Record<AppRole, { bg: string; text: string; ring: string; dot: string }> = {
deposito: { bg: "bg-blue-500/15", text: "text-blue-300", ring: "ring-blue-400/30", dot: "bg-blue-400" },
administracion: { bg: "bg-violet-500/15", text: "text-violet-300", ring: "ring-violet-400/30", dot: "bg-violet-400" },
transporte: { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-400/30", dot: "bg-amber-400" },
direccion: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-400/30", dot: "bg-emerald-400" },
coordinador_internacion: { bg: "bg-rose-500/15", text: "text-rose-300", ring: "ring-rose-400/30", dot: "bg-rose-400" },
profesional_asistencial: { bg: "bg-teal-500/15", text: "text-teal-300", ring: "ring-teal-400/30", dot: "bg-teal-400" },
medico_coordinador: { bg: "bg-indigo-500/15", text: "text-indigo-300", ring: "ring-indigo-400/30", dot: "bg-indigo-400" },
};

// Disciplinas clínicas (DF-C2 §5)
export const SPECIALTY_LABELS: Record<string, string> = {
enfermeria: "Enfermería",
medicina: "Medicina",
kinesiologia: "Kinesiología",
fonoaudiologia: "Fonoaudiología",
nutricion: "Nutrición",
trabajo_social: "Trabajo social",
otra: "Otra",
};
