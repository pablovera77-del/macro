import type { Enums } from "@/types/database";

// El enum de base de datos conserva "medico_coordinador" (no se puede quitar sin
// recrear el tipo y todas sus políticas), pero el rol se retiró de la plataforma
// (04/10/2026, comentario de Gerencia en DF-C3 §2: "Este rol no corresponde").
export type DbRole = Enums<"app_role">;
export type AppRole = Exclude<DbRole, "medico_coordinador">;

// Nombre único de cada rol: se usa en el login, el encabezado y la guía.
export const ROLE_LABELS: Record<AppRole, string> = {
  deposito: "Depósito",
  administracion: "Administración",
  transporte: "Transporte",
  direccion: "Dirección",
  coordinador_internacion: "Coordinador de Internación",
  profesional_asistencial: "Profesional Asistencial",
};

// Disciplinas clínicas (DF-C2 §5)
export const SPECIALTY_LABELS: Record<string, string> = {
enfermeria: "Enfermería",
medicina: "Medicina",
kinesiologia: "Kinesiología",
fonoaudiologia: "Fonoaudiología",
nutricion: "Nutrición",
trabajo_social: "Trabajo social",
psicologia: "Psicología",
otra: "Otra",
};
