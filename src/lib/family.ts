// Portal de familiares (G1). Mientras no haya validación legal (Ley 25.326 de
// datos personales y Ley 26.529 de derechos del paciente) el portal está
// APAGADO por defecto: se enciende en Vercel con FAMILY_PORTAL_ENABLED=1.
export function familyPortalEnabled(): boolean {
  return process.env.FAMILY_PORTAL_ENABLED === "1";
}

export type FamilyAccessInfo = {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_access_at: string | null;
  locked_until: string | null;
  creado_por: string | null;
};

export const PORTAL_ERRORES: Record<string, string> = {
  invalido: "Este link no es válido. Pedí a la clínica una tarjeta nueva.",
  vencido: "Este acceso venció o fue dado de baja. Pedí a la clínica una tarjeta nueva.",
  bloqueado: "Se ingresó un PIN incorrecto varias veces. Por seguridad, esperá 15 minutos y probá de nuevo.",
  pin: "El PIN no es correcto. Revisalo en la tarjeta que te entregó la clínica.",
  nombre: "Escribí tu nombre completo para confirmar.",
  visita: "No se pudo confirmar esa visita.",
};
