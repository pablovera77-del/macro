"use server";

import { createClient } from "@/lib/supabase/server";
import { familyPortalEnabled } from "@/lib/family";

// Acciones públicas del portal de familiares: no hay sesión. Cada llamada valida
// el link + PIN dentro de la base de datos (con bloqueo por intentos fallidos).
export type PortalVisita = {
  id: string;
  especialidad: string;
  fecha: string;
  estado: string;
  profesional: string | null;
  confirmada_at?: string | null;
  confirmada_por?: string | null;
};
export type PortalData = {
  ok: boolean;
  error?: string;
  paciente?: string;
  vence?: string;
  proximas?: PortalVisita[];
  recientes?: PortalVisita[];
};

export async function portalVerAction(token: string, pin: string): Promise<PortalData> {
  if (!familyPortalEnabled()) return { ok: false, error: "invalido" };
  if (!/^[0-9a-f]{20,64}$/.test(token) || !/^\d{6}$/.test(pin)) return { ok: false, error: "pin" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_family_portal_view", { p_token: token, p_pin: pin });
  if (error || !data) return { ok: false, error: "invalido" };
  return data as PortalData;
}

export async function portalConfirmarAction(token: string, pin: string, visitId: string, nombre: string): Promise<{ ok: boolean; error?: string }> {
  if (!familyPortalEnabled()) return { ok: false, error: "invalido" };
  if (!/^[0-9a-f]{20,64}$/.test(token) || !/^\d{6}$/.test(pin)) return { ok: false, error: "pin" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_family_confirm_visit", { p_token: token, p_pin: pin, p_visit: visitId, p_nombre: nombre });
  if (error || !data) return { ok: false, error: "visita" };
  return data as { ok: boolean; error?: string };
}
