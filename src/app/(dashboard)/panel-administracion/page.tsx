import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconGrid } from "@/components/icons";
import { hoyAR } from "@/lib/plan";
import { fechaCorta } from "@/lib/paciente";
import { autorizacionesDuplicadas } from "@/lib/semaforo";
import { cerrarAutorizacionAction } from "../internacion/actions";

function Kpi({ card, label, value, tone }: { card: string; label: string; value: number; tone: "verde" | "amarillo" | "rojo" | "gris" }) {
  return (
    <div className={card}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-center gap-2"><span className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</span><StatusBadge tone={value === 0 ? "verde" : tone} label={value === 0 ? "Al día" : "Revisar"} /></div>
    </div>
  );
}

/**
 * Panel de Administración (H10, Vanina 06/10): qué falta. Evoluciones incompletas, ingresos y egresos del mes
 * y prácticas autorizadas que todavía no tienen profesional asignado.
 */
export default async function PanelAdministracionPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "administracion") redirect("/inicio");
  const supabase = await createClient();
  const hoy = hoyAR();
  const mes = hoy.slice(0, 7);
  const desde = `${mes}-01`;
  const hasta = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);

  // Seis meses cerrados hacia atrás para los pendientes de facturación (cada uno con su primer día, que es el «período» del corte).
  const mesesAtras = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 - (i + 1), 1));
    const ini = d.toISOString().slice(0, 10);
    const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { ini, fin };
  });
  const [{ data: sinEvo }, { data: sinFirma }, { data: ingresos }, { data: egresos }, { data: autor }, { data: equipo }, { data: activos }, { data: todos }, { data: cortes }] = await Promise.all([
    supabase.from("v_visit_evolution_discrepancies").select("patient_id, especialidad, fecha_programada").order("fecha_programada"),
    supabase.from("evolutions").select("id, patient_id, especialidad, created_at").is("firma_profesional_at", null).limit(200),
    supabase.from("patients").select("id, nombre_completo, fecha_ingreso").gte("fecha_ingreso", desde).lte("fecha_ingreso", hasta).order("fecha_ingreso"),
    supabase.from("patients").select("id, nombre_completo, fecha_egreso, motivo_egreso").gte("fecha_egreso", desde).lte("fecha_egreso", hasta).order("fecha_egreso"),
    supabase.from("treatment_authorizations").select("id, patient_id, practica, especialidad, periodo_desde, periodo_hasta").gte("periodo_hasta", hoy),
    supabase.from("patient_care_team").select("patient_id, especialidad"),
    supabase.from("patients").select("id, nombre_completo").eq("estado", "activo"),
    supabase.from("patients").select("id, nombre_completo, estado, fecha_ingreso, fecha_egreso"),
    supabase.from("billing_ready").select("patient_id, periodo, revisado_at").in("periodo", mesesAtras.map((m) => m.ini)),
  ]);

  // Pacientes con servicio en un período: ingresaron antes de que termine y no se habían dado de baja antes de que empiece.
  const conServicio = (ini: string, fin: string) =>
    (todos ?? []).filter((p) => p.estado !== "admitido_pendiente_llegada" && p.fecha_ingreso && p.fecha_ingreso <= fin && (!p.fecha_egreso || p.fecha_egreso >= ini));
  const aFacturarMes = conServicio(desde, hasta);
  const revisados = new Set((cortes ?? []).filter((c) => c.revisado_at).map((c) => `${c.patient_id}:${c.periodo}`));
  const pendientesVencidos = mesesAtras.flatMap((m) =>
    conServicio(m.ini, m.fin).filter((p) => !revisados.has(`${p.id}:${m.ini}`)).map((p) => ({ p, periodo: m.ini }))
  );
  const pacientesPendientes = new Set(pendientesVencidos.map((x) => x.p.id));
  const dadosDeBaja = (todos ?? []).filter((p) => p.estado === "dado_de_baja").length;

  const nombre = new Map((activos ?? []).map((p) => [p.id, p.nombre_completo]));
  const tieneEquipo = new Set((equipo ?? []).map((t) => `${t.patient_id}:${t.especialidad}`));
  // Solo pacientes activos, y solo disciplinas con profesional asignable (la categoría «otra» no se asigna por equipo).
  const sinProfesional = (autor ?? []).filter((a) => nombre.has(a.patient_id) && a.especialidad !== "otra" && !tieneEquipo.has(`${a.patient_id}:${a.especialidad}`));

  // Dos autorizaciones vigentes de la misma práctica no pueden convivir (Vanina, 26/10): Administración cierra una.
  const duplicadas = autorizacionesDuplicadas(autor ?? [], hoy).filter((g) => nombre.has(g[0].patient_id));

  const card = "bg-white border border-slate-200 rounded-2xl p-5";
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconGrid className="w-5 h-5" />}
        title="Panel de Administración"
        section="DF-C3 / DF-C4"
        purpose="Lo que falta cerrar: evoluciones incompletas, ingresos y egresos del mes y prácticas sin profesional."
        description="Tablero de control de Administración (feedback de Vanina, 06/10)."
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className={card}>
          <div className="text-xs text-slate-500">Pacientes activos</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{(activos ?? []).length}</div>
          <Link href="/internacion?ver=activos" className="text-[11px] text-[var(--brand-teal)] underline underline-offset-2">Ver el listado</Link>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500">Pacientes a facturar en el período actual</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{aFacturarMes.length}</div>
          <div className="text-[11px] text-slate-400">Con servicio en {mes}, activos o dados de baja este mes.</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-500">Pendientes de facturación de períodos vencidos</div>
          <div className="mt-1 flex items-center gap-2"><span className="text-2xl font-semibold text-slate-900 tabular-nums">{pacientesPendientes.size}</span><StatusBadge tone={pacientesPendientes.size === 0 ? "verde" : "rojo"} label={pacientesPendientes.size === 0 ? "Al día" : "Revisar"} /></div>
          <div className="text-[11px] text-slate-400">{pendientesVencidos.length} período(s) sin revisión de Facturación en los últimos 6 meses.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi card={card} label="Visitas realizadas sin evolución" value={(sinEvo ?? []).length} tone="rojo" />
        <Kpi card={card} label="Evoluciones sin firma del profesional" value={(sinFirma ?? []).length} tone="amarillo" />
        <Kpi card={card} label="Prácticas sin profesional asignado" value={sinProfesional.length} tone="rojo" />
        <div className={card}>
          <div className="text-xs text-slate-500">Ingresos y egresos de este mes</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{(ingresos ?? []).length} / {(egresos ?? []).length}</div>
        </div>
      </div>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Pendientes de facturación de períodos vencidos ({pendientesVencidos.length})</h2>
        <p className="text-xs text-slate-500 mb-2">Pacientes que tuvieron servicio en un mes ya cerrado y cuyo corte todavía no revisó Facturación. Los pacientes dados de baja siguen acá hasta que se facturen.</p>
        {pendientesVencidos.length === 0 ? <p className="text-sm text-slate-500">No hay períodos vencidos sin revisar.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {pendientesVencidos.slice(0, 40).map((x) => (
              <li key={`${x.p.id}:${x.periodo}`} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                <span><Link href={`/paciente/${x.p.id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{x.p.nombre_completo}</Link> · período {x.periodo.slice(0, 7)}{x.p.estado === "dado_de_baja" && <span className="ml-2 text-xs text-slate-400">dado de baja</span>}</span>
                <Link href="/listo-para-facturar" className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">Marcar listo para facturar</Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-xs text-slate-500">Consultar historia clínica y datos de pacientes dados de baja: <Link href="/internacion?ver=dados_de_baja" className="font-medium text-[var(--brand-teal)] underline underline-offset-2">ver los {dadosDeBaja} paciente(s) dados de baja</Link>.</div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Autorizaciones duplicadas ({duplicadas.length})</h2>
        <p className="text-xs text-slate-500 mb-2">Misma práctica autorizada dos veces en el mismo período para un paciente. Cerrá la que sobra: queda vigente hasta ayer y se conserva en el historial.</p>
        {duplicadas.length === 0 ? <p className="text-sm text-slate-500">No hay autorizaciones duplicadas.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {duplicadas.map((g) => (
              <li key={`${g[0].patient_id}:${g[0].practica}`} className="py-2">
                <Link href={`/paciente/${g[0].patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{nombre.get(g[0].patient_id)}</Link> · {g[0].practica}
                <ul className="mt-1 space-y-1">
                  {g.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 flex-wrap text-xs text-slate-600">
                      <span>Del {fechaCorta(a.periodo_desde)} al {fechaCorta(a.periodo_hasta)}</span>
                      <form action={cerrarAutorizacionAction}>
                        <input type="hidden" name="authorization_id" value={a.id} />
                        <input type="hidden" name="patient_id" value={a.patient_id} />
                        <button type="submit" className="font-medium text-[var(--brand-teal)] underline underline-offset-2">Cerrar esta</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Prácticas autorizadas sin profesional asignado ({sinProfesional.length})</h2>
        {sinProfesional.length === 0 ? <p className="text-sm text-slate-500">Todas las prácticas vigentes tienen profesional.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {sinProfesional.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                <span><Link href={`/paciente/${a.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{nombre.get(a.patient_id)}</Link> · {a.practica} <span className="text-xs text-slate-400">({SPECIALTY_LABELS[a.especialidad] ?? a.especialidad}, vence {fechaCorta(a.periodo_hasta)})</span></span>
                <Link href="/internacion" className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">Asignar equipo</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Visitas realizadas sin evolución cargada ({(sinEvo ?? []).length})</h2>
        {(sinEvo ?? []).length === 0 ? <p className="text-sm text-slate-500">No hay evoluciones pendientes.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(sinEvo ?? []).slice(0, 30).map((v, i) => (
              <li key={i} className="py-2"><Link href={`/paciente/${v.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{nombre.get(v.patient_id ?? "") ?? "Paciente"}</Link> · {SPECIALTY_LABELS[v.especialidad ?? ""] ?? v.especialidad} · visita del {fechaCorta(v.fecha_programada)}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Ingresos del mes ({(ingresos ?? []).length})</h2>
          {(ingresos ?? []).length === 0 ? <p className="text-sm text-slate-500">Sin ingresos este mes.</p> : <ul className="text-sm space-y-1">{(ingresos ?? []).map((p) => <li key={p.id}>{fechaCorta(p.fecha_ingreso)} · <Link href={`/paciente/${p.id}`} className="hover:underline underline-offset-2">{p.nombre_completo}</Link></li>)}</ul>}
        </section>
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Egresos del mes ({(egresos ?? []).length})</h2>
          {(egresos ?? []).length === 0 ? <p className="text-sm text-slate-500">Sin egresos este mes.</p> : <ul className="text-sm space-y-1">{(egresos ?? []).map((p) => <li key={p.id}>{fechaCorta(p.fecha_egreso)} · <Link href={`/paciente/${p.id}`} className="hover:underline underline-offset-2">{p.nombre_completo}</Link></li>)}</ul>}
        </section>
      </div>
    </div>
  );
}
