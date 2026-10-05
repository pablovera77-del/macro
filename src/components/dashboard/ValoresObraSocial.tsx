import { createClient } from "@/lib/supabase/server";
import { hoyAR } from "@/lib/plan";
import { formatARS } from "@/lib/facturacion";
import StatusBadge from "@/components/StatusBadge";
import { IconChart } from "@/components/icons";

// Valores y aumentos por obra social a lo largo del año (C4-14). Lee el historial de valores:
// "valor al inicio del año" es el que regía el 1 de enero (o el primero cargado en el año).

function Serie({ valores, nombre }: { valores: number[]; nombre: string }) {
  const w = 84;
  const h = 26;
  if (valores.length < 2) {
    return <span className="text-[11px] text-slate-400">sin cambios</span>;
  }
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const puntos = valores.map((v, i) => `${(i / (valores.length - 1)) * (w - 6) + 3},${h - 3 - ((v - min) / rango) * (h - 6)}`);
  const ultimo = puntos[puntos.length - 1].split(",");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Valores de ${nombre}: ${valores.map((v) => formatARS(v)).join(", ")}`}>
      <polyline points={puntos.join(" ")} fill="none" stroke="var(--brand-teal)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ultimo[0]} cy={ultimo[1]} r="2.5" fill="var(--brand-teal)" />
    </svg>
  );
}

export default async function ValoresObraSocial() {
  const supabase = await createClient();
  const anio = hoyAR().slice(0, 4);
  const [{ data: historial }, { data: obras }] = await Promise.all([
    supabase.from("obra_social_value_history").select("obra_social_id, valor, vigente_desde").order("vigente_desde").order("id"),
    supabase.from("obras_sociales").select("id, nombre").eq("activa", true).order("nombre"),
  ]);

  const filas = (obras ?? [])
    .map((os) => {
      const todos = (historial ?? []).filter((h) => h.obra_social_id === os.id);
      if (todos.length === 0) return null;
      const delAnio = todos.filter((h) => h.vigente_desde.slice(0, 4) === anio);
      // El valor que regía el 1 de enero; si no había ninguno, el primero cargado en el año.
      const previos = todos.filter((h) => h.vigente_desde <= `${anio}-01-01`);
      const inicial = previos.length > 0 ? previos[previos.length - 1] : delAnio[0];
      const actual = todos[todos.length - 1];
      if (!inicial) return null;
      const serie = [inicial, ...delAnio.filter((h) => h !== inicial)].map((h) => h.valor);
      const aumento = inicial.valor > 0 ? ((actual.valor - inicial.valor) / inicial.valor) * 100 : 0;
      return { id: os.id, nombre: os.nombre, inicial: inicial.valor, actual: actual.valor, aumento, serie, cambios: serie.length - 1 };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort((a, b) => b.aumento - a.aumento);

  const conAumento = filas.filter((f) => f.aumento > 0);
  const promedio = conAumento.length > 0 ? conAumento.reduce((acc, f) => acc + f.aumento, 0) / conAumento.length : 0;
  const pct = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up" aria-label="Valores y aumentos por obra social">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <IconChart className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-900">Valores y aumentos por obra social, {anio}</h2>
        </div>
        {conAumento.length > 0 && (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-3 py-1">
            Aumento promedio: {pct(promedio)} ({conAumento.length} de {filas.length} obras sociales)
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Obra social</th>
              <th className="text-right px-5 py-2.5 font-medium whitespace-nowrap">Valor a inicio de año</th>
              <th className="text-right px-5 py-2.5 font-medium whitespace-nowrap">Valor actual</th>
              <th className="text-right px-5 py-2.5 font-medium">Aumento</th>
              <th className="text-left px-5 py-2.5 font-medium">Evolución</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f) => (
              <tr key={f.id} className="row-hover hover:bg-slate-50">
                <td className="px-5 py-2.5 text-slate-900 whitespace-nowrap">{f.nombre}</td>
                <td className="px-5 py-2.5 text-right text-slate-600 tabular-nums">{formatARS(f.inicial)}</td>
                <td className="px-5 py-2.5 text-right text-slate-900 font-medium tabular-nums">{formatARS(f.actual)}</td>
                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                  {f.aumento > 0 ? (
                    <StatusBadge tone="verde" label={`+${pct(f.aumento)}`} />
                  ) : (
                    <StatusBadge tone="gris" label="Sin aumento" />
                  )}
                  {f.cambios > 0 && <span className="block text-[11px] text-slate-400 mt-0.5">{f.cambios} actualización{f.cambios === 1 ? "" : "es"}</span>}
                </td>
                <td className="px-5 py-2.5"><Serie valores={f.serie} nombre={f.nombre} /></td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">Todavía no hay valores cargados. Se cargan en Obras sociales.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 px-5 py-3 border-t border-slate-100">
        El aumento compara el valor actual del módulo con el que regía el 1 de enero. Ordenado de mayor a menor aumento.
      </p>
    </section>
  );
}
