import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import HonorariosForm from "@/components/facturacion/HonorariosForm";
import { IconCash } from "@/components/icons";
import { PRACTICAS } from "@/lib/autorizaciones";
import { formatARS } from "@/lib/facturacion";

/** Honorarios por prestación (H9): los carga Dirección; Facturación los consulta para armar presupuestos. */
export default async function HonorariosPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "direccion" && profile.role !== "facturacion") redirect("/inicio");
  const supabase = await createClient();
  const { data } = await supabase.from("honorarios_prestacion").select("practica_tipo, costo_unitario");
  const valores = Object.fromEntries((data ?? []).map((h) => [h.practica_tipo, Number(h.costo_unitario)]));
  const puedeCargar = profile.role === "direccion";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconCash className="w-5 h-5" />}
        title="Honorarios por prestación"
        section="DF-C4"
        purpose={
          puedeCargar
            ? "Cargá lo que cuesta cada prestación. Facturación lo usa para calcular el costo y la rentabilidad de los presupuestos."
            : "Costo de cada prestación cargado por Dirección. Se usa en los presupuestos."
        }
        description="Pendiente de confirmar con Vanina si el costo es por tipo de prestación o por profesional."
      />
      {puedeCargar ? (
        <HonorariosForm valores={valores} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRACTICAS.map((p) => (
            <li key={p.codigo} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="text-slate-700">{p.label}</span>
              <span className="tabular-nums text-slate-900">{valores[p.codigo] != null ? formatARS(valores[p.codigo]) : <span className="text-slate-400">sin cargar</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
