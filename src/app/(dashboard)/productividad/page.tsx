import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconChart } from "@/components/icons";
import { calcularCumplimiento, describirPlan, semanaActual, UMBRAL_VISITAS_DIA, TZ, DISCIPLINAS_PLAN, type Plan } from "@/lib/plan";
import { calcularProductividad, DIAS_PRODUCTIVIDAD, ROLES_PRODUCTIVIDAD, type VisitaProd } from "@/lib/productividad";

const campo = "rounded-xl border border-slate-300 px-3 py-2.5 text-sm";
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ, day: "numeric", month: "long" });

/**
 * Productividad y cupos (solo lectura): cuántas visitas del plan de cada paciente se hicieron esta
 * semana, cuáles faltan y cuáles sobran, y el promedio diario de visitas de cada profesional.
 */
export default async function ProductividadPage({ searchParams }: { searchParams: Promise<{ esp?: string }> }) {
  const { esp } = await searchParams;
  const { profile } = await requireProfile();
  if (!ROLES_PRODUCTIVIDAD.includes(profile.role)) redirect("/inicio");
  const supabase = await createClient();
  const disciplina = (DISCIPLINAS_PLAN as readonly string[]).includes(esp ?? "") ? (esp as string) : "";

  const ahora = new Date();
  const sem = semanaActual(ahora);
  const hace40 = new Date(ahora.getTime() - (DIAS_PRODUCTIVIDAD + 10) * 86400000).toISOString();
  const [{ data: pacientes }, { data: planesRaw }, { data: visitas }, { data: profes }] = await Promise.all([
    supabase.from("patients").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo"),
    supabase.from("treatment_plans").select("id, patient_id, especialidad, cantidad, unidad, dias_semana, desde, hasta, activo, nota").eq("activo", true),
    supabase.from("visits").select("patient_id, profesional_id, especialidad, estado, fecha_programada, fecha_realizada").gte("fecha_programada", hace40),
    supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name"),
  ]);
  const nombres = new Map((pacientes ?? []).map((p) => [p.id, p.nombre_completo]));
  const todas = visitas ?? [];

  // Cupos de la semana (R66): se muestran los que todavía no se completaron; los completos quedan aparte.
  const cupos = calcularCumplimiento(
    ((planesRaw ?? []) as unknown as Plan[]).filter((pl) => nombres.has(pl.patient_id) && (!disciplina || pl.especialidad === disciplina)),
    todas,
    sem
  ).sort((a, b) => (nombres.get(a.plan.patient_id) ?? "").localeCompare(nombres.get(b.plan.patient_id) ?? "", "es"));
  const pendientes = cupos.filter((c) => c.realizadas < c.esperadas || c.sobran > 0);
  const completos = cupos.filter((c) => c.realizadas >= c.esperadas && c.sobran === 0);
  const totales = {
    esperadas: cupos.reduce((s, c) => s + c.esperadas, 0),
    realizadas: cupos.reduce((s, c) => s + c.realizadas, 0),
    faltan: cupos.reduce((s, c) => s + c.faltan, 0),
    sobran: cupos.reduce((s, c) => s + c.sobran, 0),
  };

  // Promedio diario por profesional (R63, R64).
  const filas = calcularProductividad((todas as VisitaProd[]).filter((v) => !disciplina || v.especialidad === disciplina), ahora);
  const nombreProf = new Map((profes ?? []).map((p) => [p.id, p.full_name]));
  const sinVisitas = disciplina ? [] : (profes ?? []).filter((p) => !filas.some((f) => f.profesional_id === p.id));

  const fila = (c: (typeof cupos)[number]) => (
    <tr key={c.plan.id} className="hover:bg-slate-50">
      <td className="px-4 py-2.5 text-slate-900">
        <Link href={`/paciente/${c.plan.patient_id}`} className="hover:underline underline-offset-2">{nombres.get(c.plan.patient_id)}</Link>
      </td>
      <td className="px-4 py-2.5 text-slate-600">{SPECIALTY_LABELS[c.plan.especialidad] ?? c.plan.especialidad}</td>
      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{describirPlan(c.plan)}</td>
      <td className="px-4 py-2.5 text-slate-900 font-medium">{c.realizadas} de {c.esperadas}</td>
      <td className="px-4 py-2.5 text-slate-600">{Math.max(0, c.cubiertas - c.realizadas)}</td>
      <td className="px-4 py-2.5">{c.faltan > 0 ? <StatusBadge tone="amarillo" label={`Faltan ${c.faltan}`} /> : <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-2.5">{c.sobran > 0 ? <StatusBadge tone="amarillo" label={`Sobran ${c.sobran}`} /> : <span className="text-slate-300">—</span>}</td>
    </tr>
  );
  const cabecera = (
    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
      <tr>
        <th className="text-left px-4 py-2.5 font-medium">Paciente</th>
        <th className="text-left px-4 py-2.5 font-medium">Disciplina</th>
        <th className="text-left px-4 py-2.5 font-medium">Plan</th>
        <th className="text-left px-4 py-2.5 font-medium">Realizadas</th>
        <th className="text-left px-4 py-2.5 font-medium">Programadas</th>
        <th className="text-left px-4 py-2.5 font-medium">Falta programar</th>
        <th className="text-left px-4 py-2.5 font-medium">De más</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconChart className="w-5 h-5" />}
        title="Productividad y cupos"
        section="DF-C2 §7 (R63-R66)"
        purpose="Cuántas visitas del plan de cada paciente se hicieron esta semana, cuáles faltan o sobran, y cuántas visitas por día hace cada profesional. Es una pantalla de consulta."
        description="Cupo semanal (R66, R05) y promedio diario por profesional (R63-R65), usando lib/plan.ts."
      />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Disciplina</span>
          <select name="esp" defaultValue={disciplina} className={`${campo} mt-1 block`}>
            <option value="">Todas</option>
            {DISCIPLINAS_PLAN.map((d) => (
              <option key={d} value={d}>{SPECIALTY_LABELS[d] ?? d}</option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800">Filtrar</button>
      </form>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Cupos de la semana</h2>
          <p className="text-xs text-slate-500">Semana del {fechaCorta(sem.desde)} al {fechaCorta(new Date(new Date(sem.hasta).getTime() - 86400000).toISOString())}. Cada lunes se recalcula sola.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { t: "Visitas del plan", v: totales.esperadas },
            { t: "Realizadas", v: totales.realizadas },
            { t: "Falta programar", v: totales.faltan },
            { t: "De más", v: totales.sobran },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{x.t}</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{x.v}</div>
            </div>
          ))}
        </div>
        {cupos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">No hay pacientes con plan de tratamiento activo{disciplina ? " en esa disciplina" : ""}.</div>
        ) : pendientes.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Todos los cupos de la semana están completos.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              {cabecera}
              <tbody className="divide-y divide-slate-100">{pendientes.map(fila)}</tbody>
            </table>
          </div>
        )}
        {completos.length > 0 && (
          <details className="bg-white rounded-2xl border border-slate-200">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-700">Cupos completos de la semana ({completos.length})</summary>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                {cabecera}
                <tbody className="divide-y divide-slate-100">{completos.map(fila)}</tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Visitas por día de cada profesional</h2>
          <p className="text-xs text-slate-500">
            Últimos {DIAS_PRODUCTIVIDAD} días. El promedio es de visitas realizadas por cada día en que el profesional hizo al menos una. Se marca cuando está por debajo de {UMBRAL_VISITAS_DIA} visitas por día
            (valor provisorio; más adelante se podrá editar).
          </p>
        </div>
        {filas.length === 0 && sinVisitas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Todavía no hay visitas realizadas en este período.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Profesional</th>
                  <th className="text-left px-4 py-2.5 font-medium">Disciplina</th>
                  <th className="text-left px-4 py-2.5 font-medium">Visitas realizadas ({DIAS_PRODUCTIVIDAD} días)</th>
                  <th className="text-left px-4 py-2.5 font-medium">Días con visitas</th>
                  <th className="text-left px-4 py-2.5 font-medium">Promedio por día</th>
                  <th className="text-left px-4 py-2.5 font-medium">Esta semana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f) => (
                  <tr key={f.profesional_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-900">{nombreProf.get(f.profesional_id) ?? "Profesional dado de baja"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{f.disciplinas.map((d) => SPECIALTY_LABELS[d] ?? d).join(", ")}</td>
                    <td className="px-4 py-2.5 text-slate-900">{f.realizadas}</td>
                    <td className="px-4 py-2.5 text-slate-600">{f.diasActivos}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-900 mr-2">{f.promedioDiario.toLocaleString("es-AR")}</span>
                      {f.bajoUmbral ? <StatusBadge tone="amarillo" label={`Menos de ${UMBRAL_VISITAS_DIA} por día`} /> : <StatusBadge tone="verde" label="En el nivel esperado" />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">{f.realizadasSemana}</td>
                  </tr>
                ))}
                {sinVisitas.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-900">{p.full_name}</td>
                    <td className="px-4 py-2.5 text-slate-400">—</td>
                    <td className="px-4 py-2.5 text-slate-400">0</td>
                    <td className="px-4 py-2.5 text-slate-400">0</td>
                    <td className="px-4 py-2.5"><StatusBadge tone="gris" label="Sin visitas realizadas" /></td>
                    <td className="px-4 py-2.5 text-slate-400">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
