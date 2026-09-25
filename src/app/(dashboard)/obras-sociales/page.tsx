import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createObraSocialAction, addValueHistoryAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import { IconBuilding } from "@/components/icons";

function formatARS(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export default async function ObrasSocialesPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();

  const [{ data: obrasSociales }, { data: history }, { data: patientCounts }] = await Promise.all([
    supabase.from("obras_sociales").select("id, nombre, cuit, dias_para_facturar, valor_modulo, activa").order("nombre"),
    supabase.from("obra_social_value_history").select("id, obra_social_id, valor, vigente_desde").order("vigente_desde", { ascending: false }),
    supabase.from("patients").select("obra_social_id").eq("estado", "activo"),
  ]);

  const canManage = profile.role === "administracion" || profile.role === "direccion";
  const countByOs = new Map<string, number>();
  (patientCounts ?? []).forEach((p) => {
    if (p.obra_social_id) countByOs.set(p.obra_social_id, (countByOs.get(p.obra_social_id) ?? 0) + 1);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconBuilding className="w-5 h-5" />}
        title="Obras sociales"
        section="DF-C1 §3 · DF-C4 §2/§3"
        description="Catálogo con plazo de facturación e histórico de valores por módulo — evita perder trazabilidad cuando un valor cambia (DF-C4 §3)."
      />

      <section className="space-y-3">
        {(obrasSociales ?? []).map((os, i) => {
          const hist = (history ?? []).filter((h) => h.obra_social_id === os.id).slice(0, 5);
          return (
            <div key={os.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium text-slate-900">{os.nombre}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {os.cuit ? `CUIT ${os.cuit} · ` : ""}Plazo de facturación: {os.dias_para_facturar} días · {countByOs.get(os.id) ?? 0} pacientes activos
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{formatARS(os.valor_modulo)}</div>
                  <div className="text-[11px] text-slate-400">valor de módulo vigente</div>
                </div>
              </div>

              {hist.length > 0 && (
                <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-1.5">
                  {hist.map((h) => (
                    <span key={h.id} className="bg-slate-50 rounded-full px-2.5 py-1">
                      {formatARS(h.valor)} desde {h.vigente_desde}
                    </span>
                  ))}
                </div>
              )}

              {canManage && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-800">+ Actualizar valor</summary>
                  <form action={addValueHistoryAction} className="flex flex-wrap gap-2 mt-2">
                    <input type="hidden" name="obra_social_id" value={os.id} />
                    <input name="valor" type="number" step="0.01" placeholder="Nuevo valor" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-32" />
                    <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Actualizar</button>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </section>

      {canManage && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
          <h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">+</span>
            Nueva obra social
          </h2>
          <form action={createObraSocialAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input name="nombre" placeholder="Nombre" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <input name="cuit" placeholder="CUIT (opcional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="dias_para_facturar" type="number" defaultValue="10" placeholder="Días para facturar" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="valor_modulo" type="number" step="0.01" placeholder="Valor inicial de módulo" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-2">
              Crear
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
