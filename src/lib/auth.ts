import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROLE_LABELS, SPECIALTY_LABELS, type AppRole, type DbRole } from "@/lib/roles";

export { ROLE_LABELS, SPECIALTY_LABELS };
export type { AppRole, DbRole };

// Quién hace qué en el ingreso de pacientes (DF-C3 §2 y §3):
// Administración da de alta, gestiona el legajo, las firmas, el equipo y las prórrogas.
export const ROLES_ALTA: AppRole[] = ["administracion"];
// Coordinación arma la agenda y confirma la llegada al domicilio para coordinar la primera visita.
export const ROLES_AGENDA: AppRole[] = ["coordinador_internacion"];

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

if (!profile || !profile.active || profile.role === "medico_coordinador") {
redirect("/auth/salir?error=cuenta_inactiva");
}

return { user, profile: { ...profile, role: profile.role as AppRole } };
}

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
| "compras"
| "inicio"
| "ayuda"
| "auditoria";

export const NAV_BY_ROLE: Record<AppRole, { href: string; label: string; icon: NavIconId; description: string }[]> = {
deposito: [
{ href: "/inicio", label: "Inicio", icon: "inicio", description: "Qué podés hacer acá" },
{ href: "/catalogo", label: "Catálogo", icon: "catalogo", description: "Insumos y equipos" },
{ href: "/pedidos", label: "Pedidos", icon: "pedidos", description: "Entregas a domicilio" },
{ href: "/seguimiento", label: "Seguimiento", icon: "seguimiento", description: "Equipos en tránsito" },
{ href: "/compras", label: "Compras", icon: "compras", description: "Proyección y cotizaciones" },
{ href: "/ayuda", label: "Guía de uso", icon: "ayuda", description: "Cómo se hace cada cosa" },
],
administracion: [
{ href: "/inicio", label: "Inicio", icon: "inicio", description: "Qué podés hacer acá" },
{ href: "/internacion", label: "Pacientes", icon: "internacion", description: "Alta, legajo y egresos" },
{ href: "/pacientes", label: "Autorizaciones de stock", icon: "pacientes", description: "Stock por paciente y bajas" },
{ href: "/pedidos", label: "Pedidos", icon: "pedidos", description: "Entregas a domicilio" },
{ href: "/seguimiento", label: "Seguimiento", icon: "seguimiento", description: "Equipos en tránsito" },
{ href: "/compras", label: "Compras", icon: "compras", description: "Proyección y cotizaciones" },
{ href: "/obras-sociales", label: "Obras sociales", icon: "obras_sociales", description: "Catálogo y valores" },
{ href: "/facturacion", label: "Facturación", icon: "facturacion", description: "Cierre mensual y débitos" },
{ href: "/productividad", label: "Productividad y cupos", icon: "dashboard", description: "Visitas por profesional y cupos" },
{ href: "/ayuda", label: "Guía de uso", icon: "ayuda", description: "Cómo se hace cada cosa" },
],
transporte: [
{ href: "/inicio", label: "Inicio", icon: "inicio", description: "Qué podés hacer acá" },
{ href: "/pedidos", label: "Pedidos", icon: "pedidos", description: "Entregas a domicilio" },
{ href: "/seguimiento", label: "Seguimiento", icon: "seguimiento", description: "Equipos en tránsito" },
{ href: "/ayuda", label: "Guía de uso", icon: "ayuda", description: "Cómo se hace cada cosa" },
],
direccion: [
{ href: "/inicio", label: "Inicio", icon: "inicio", description: "Qué podés hacer acá" },
{ href: "/dashboard", label: "Dashboard ejecutivo", icon: "dashboard", description: "Vista en tiempo real" },
{ href: "/productividad", label: "Productividad y cupos", icon: "dashboard", description: "Visitas por profesional y cupos" },
{ href: "/auditoria", label: "Auditoría", icon: "auditoria", description: "Quién cambió qué" },
{ href: "/ayuda", label: "Guía de uso", icon: "ayuda", description: "Cómo se hace cada cosa" },
],
coordinador_internacion: [
{ href: "/inicio", label: "Inicio", icon: "inicio", description: "Qué podés hacer acá" },
{ href: "/internacion", label: "Pacientes", icon: "internacion", description: "Consulta y llegada al domicilio" },
{ href: "/agenda", label: "Agenda", icon: "agenda", description: "Visitas domiciliarias" },
{ href: "/evoluciones", label: "Control de evoluciones", icon: "evoluciones", description: "Visitas sin historia clínica" },
{ href: "/pedidos", label: "Pedir insumos", icon: "pedidos", description: "Solicitudes a Depósito" },
{ href: "/productividad", label: "Productividad y cupos", icon: "dashboard", description: "Visitas por profesional y cupos" },
{ href: "/ayuda", label: "Guía de uso", icon: "ayuda", description: "Cómo se hace cada cosa" },
],
profesional_asistencial: [
{ href: "/inicio", label: "Inicio", icon: "inicio", description: "Qué podés hacer acá" },
{ href: "/agenda", label: "Mi agenda", icon: "agenda", description: "Visitas asignadas" },
{ href: "/evoluciones", label: "Historia clínica", icon: "evoluciones", description: "Evoluciones por disciplina" },
{ href: "/internacion", label: "Mis pacientes", icon: "internacion", description: "Informar egreso" },
{ href: "/ayuda", label: "Guía de uso", icon: "ayuda", description: "Cómo se hace cada cosa" },
],
};

export const ROLE_ACCENT: Record<AppRole, { bg: string; text: string; ring: string; dot: string }> = {
deposito: { bg: "bg-blue-500/15", text: "text-blue-300", ring: "ring-blue-400/30", dot: "bg-blue-400" },
administracion: { bg: "bg-violet-500/15", text: "text-violet-300", ring: "ring-violet-400/30", dot: "bg-violet-400" },
transporte: { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-400/30", dot: "bg-amber-400" },
direccion: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-400/30", dot: "bg-emerald-400" },
coordinador_internacion: { bg: "bg-rose-500/15", text: "text-rose-300", ring: "ring-rose-400/30", dot: "bg-rose-400" },
profesional_asistencial: { bg: "bg-teal-500/15", text: "text-teal-300", ring: "ring-teal-400/30", dot: "bg-teal-400" },
};
