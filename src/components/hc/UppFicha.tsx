import { createClient } from "@/lib/supabase/server";
import UppBadge from "@/components/hc/UppBadge";

/** Último riesgo de úlceras por presión del paciente (si alguna vez se valoró). Para la cabecera de la ficha. */
export default async function UppFicha({ patientId }: { patientId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("evolutions")
    .select("upp_escala_nova5, created_at")
    .eq("patient_id", patientId)
    .not("upp_escala_nova5", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return <UppBadge nova5={data.upp_escala_nova5} fecha={data.created_at} />;
}
