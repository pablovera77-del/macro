import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconChart } from "@/components/icons";
import { hoyAR } from "@/lib/plan";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Informe histórico mensual (H10, Vanina 06/10): pacientes atendidos, facturados, ingresos y egresos de los últimos 12 meses.
 * Solo Facturación y Dirección.
 */
export default async function InformeMensualPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "facturacion" && profile.role !== "direccion") redirect("/inicio");
  const supabase = await createClient();
  const hoy = hoyAR();

  const meses: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 - i, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  const desde = `${meses[0]}-01`;

  const [{ data: pacientes }, { data: listos }] = await Promise.all([
    supabase.from("patients").select("id, fecha_ingreso, fecha_egreso").or(`fecha_egreso.is.null,fecha_egreso.gte.${desde}`),
    supabase.from("billing_ready").select("patient_id, periodo").gte("periodo", desde),
  ]);

  const filas = meses.map((m) => {
    const ini = `${m}-01`;
    const fin = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const ps = pacientes ?? [];
    return {
      m,
      atendidos: ps.filter((p) => p.fecha_ingreso && p.fecha_ingreso <= fin && (!p.fecha_egreso || p.fecha_egreso >= ini)).length,
      ingresos: ps.filter((p) => p.fecha_ingreso && p.fecha_ingreso >= ini && p.fecha_ingreso <= fin).length,
      egresos: ps.filter((p) => p.fecha_egreso && p.fecha_egreso >= ini && p.fecha_egreso <= fin).length,
      facturados: (listos ?? []).filter((l) => l.periodo.slice(0, 7) === m).length,
    };
  });
  const maxAt = Math.max(1, ...filas.map((f) => f.atendidos));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconChart className="w-5 h-5" />}
        title="Informe histórico mensual"
        section="DF-C4"
        purpose="Cuántos pacientes se atendieron, ingresaron, egresaron y quedaron listos para facturar en cada uno de los últimos 12 meses."
        description="«Facturados» cuenta los pacientes que Administración marcó como listos para facturar (feedback de Vanina, 06/10)."
      />
      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2.5 px-4 font-medium">Mes</th>
              <th className="py-2.5 px-3 font-medium">Pacientes atendidos</th>
              <th className="py-2.5 px-3 font-medium text-right">Ingresos</th>
              <th className="py-2.5 px-3 font-medium text-right">Egresos</th>
              <th className="py-2.5 px-4 font-medium text-right">Listos para facturar</th>
            </tr>
          </thead>
          <tbody>
            {[...filas].reverse().map((f) => (
              <tr key={f.m} className="border-b border-slate-100">
                <td className="py-2 px-4 text-slate-800 capitalize">{MESES[Number(f.m.slice(5, 7)) - 1]} {f.m.slice(0, 4)}</td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2"><div className="h-2 rounded bg-slate-300" style={{ width: `${Math.max((f.atendidos / maxAt) * 160, f.atendidos ? 4 : 0)}px` }} /><span className="tabular-nums">{f.atendidos}</span></div>
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{f.ingresos}</td>
                <td className="py-2 px-3 text-right tabular-nums">{f.egresos}</td>
                <td className="py-2 px-4 text-right tabular-nums">{f.facturados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
