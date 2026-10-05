import type { AppRole } from "@/lib/roles";

// Roles que se pueden asignar desde la pantalla de Usuarios (el rol «Médico coordinador» está retirado).
export const ROLES_ASIGNABLES: AppRole[] = [
  "administracion",
  "coordinador_internacion",
  "profesional_asistencial",
  "deposito",
  "transporte",
  "direccion",
];

export const ROL_DESCRIPCION: Record<AppRole, string> = {
  administracion: "Altas, legajos, autorizaciones, facturación y equipo",
  coordinador_internacion: "Agenda de visitas y pedidos de insumos",
  profesional_asistencial: "Visitas y historia clínica de sus pacientes",
  deposito: "Catálogo, pedidos y compras",
  transporte: "Entregas y retiros",
  direccion: "Solo lectura: tableros y auditoría",
};

/** Contraseña provisoria legible (sin caracteres que se confunden). El usuario la cambia con «Olvidé mi contraseña». */
export function passwordProvisoria() {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
