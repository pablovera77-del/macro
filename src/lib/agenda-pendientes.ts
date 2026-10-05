import { createClient } from "@/lib/supabase/server";
import { calcularCumplimiento, semanaActual, type Plan } from "@/lib/plan";
import { estaAtrasada } from "@/lib/horario";

// Contadores de «Para hacer hoy» de Coordinación (G4 / Inicio). Si una consulta falla devuelven null
// y el contador simplemente no se muestra (Inicio nunca debe romperse).

/** Cantidad de disciplinas de pacientes activos con visitas del plan todavía sin programar esta semana. */
export async function contarFaltanProgramar(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const sem = semanaActual();
    const [pacientes, planes, visitas] = await Promise.all([
      supabase.from("patients").select("id").eq("estado", "activo"),
      supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota").eq("activo", true),
      supabase.from("visits").select("patient_id, especialidad, fecha_programada, estado").gte("fecha_programada", sem.desde).lt("fecha_programada", sem.hasta),
    ]);
    if (pacientes.error || planes.error || visitas.error) return null;
    const activos = new Set((pacientes.data ?? []).map((p) => p.id));
    return calcularCumplimiento(
      ((planes.data ?? []) as unknown as Plan[]).filter((pl) => activos.has(pl.patient_id)),
      visitas.data ?? [],
      sem
    ).filter((c) => c.faltan > 0).length;
  } catch {
    return null;
  }
}

/** Visitas programadas o confirmadas cuya fecha (o franja) ya pasó y nadie cerró. */
export async function contarAtrasadas(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("visits")
      .select("fecha_programada, sin_hora, franja, hora_desde, hora_hasta")
      .in("estado", ["programada", "confirmada"])
      .lt("fecha_programada", new Date().toISOString());
    if (error) return null;
    return (data ?? []).filter((v) => estaAtrasada(v)).length;
  } catch {
    return null;
  }
}
