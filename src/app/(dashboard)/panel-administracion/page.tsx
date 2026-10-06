import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconGrid } from "@/components/icons";
import { hoyAR } from "@/lib/plan";
import { fechaCorta } from "@/lib/paciente";

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

  const [{ data: sinEvo }, { data: sinFirma }, { data: ingresos }, { data: egresos }, { data: autor }, { data: equipo }, { data: activos }] = await Promise.all([
    supabase.from("v_visit_evolution_discrepancies").select("patient_id, especialidad, fecha_programada").order("fecha_programada"),
    supabase.from("evolutions").select("id, patient_id, especialidad, created_at").is("firma_profesional_at", null).limit(200),
    supabase.from("patients").select("id, nombre_completo, fecha_ingreso").gte("fecha_ingreso", desde).lte("fecha_ingreso", hasta).order("fecha_ingreso"),
    supabase.from("patients").select("id, nombre_completo, fecha_egreso, motivo_egreso").gte("fecha_egreso", desde).lte("fecha_egreso", hasta).order("fecha_egreso"),
    supabase.from("treatment_authorizations").select("id, patient_id, practica, especialidad, periodo_hasta").gte("periodo_hasta", hoy),
    supabase.from("patient_care_team").select("patient_id, especialidad"),
    supabase.from("patients").select("id, nombre_completo").eq("estado", "activo"),
  ]);

  const nombre = new Map((activos ?? []).map((p) => [p.id, p.nombre_completo]));
  const tieneEquipo = new Set((equipo ?? []).map((t) => `${t.patient_id}:${t.especialidad}`));
  // Solo pacientes activos, y solo disciplinas con profesional asignable (la categoría «otra» no se asigna por equipo).
  const sinProfesional = (autor ?? []).filter((a) => nombre.has(a.patient_id) && a.especialidad !== "otra" && !tieneEquipo.has(`${a.patient_id}:${a.especialidad}`));

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
