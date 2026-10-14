import { createClient } from "@/lib/supabase/server";
import UppBadge from "@/components/hc/UppBadge";

/**
 * Último riesgo de úlceras por presión del paciente para la cabecera de la ficha: el más reciente entre
 * la valoración de ingreso (la carga Administración, DF-C2 pregunta 8) y las evoluciones de enfermería.
 */
export default async function UppFicha({ patientId }: { patientId: string }) {
  const supabase = await createClient();
  const [{ data: evo }, { data: pac }] = await Promise.all([
    supabase
      .from("evolutions")
      .select("upp_escala_nova5, created_at")
      .eq("patient_id", patientId)
      .not("upp_escala_nova5", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("patients").select("upp_ingreso_nova5, upp_ingreso_at").eq("id", patientId).maybeSingle(),
  ]);
  const ingreso = pac?.upp_ingreso_nova5 ? { nova5: pac.upp_ingreso_nova5, fecha: pac.upp_ingreso_at } : null;
  const ultima = evo ? { nova5: evo.upp_escala_nova5, fecha: evo.created_at } : null;
  const elegida = ultima && (!ingreso || !ingreso.fecha || ultima.fecha > ingreso.fecha) ? ultima : ingreso;
  if (!elegida) return null;
  return <UppBadge nova5={elegida.nova5} fecha={elegida.fecha} />;
}
