import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import StatusBadge from "@/components/StatusBadge";
import ListoParaFacturarForm, { type FilaListo } from "@/components/facturacion/ListoParaFacturarForm";
import { IconCash } from "@/components/icons";
import { hoyAR } from "@/lib/plan";
import { fechaCorta } from "@/lib/paciente";
import { desmarcarListoAction, marcarRevisadoAction } from "./actions";

const ROLES = ["administracion", "facturacion", "direccion"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function mesLabel(mes: string) {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
}
function mesMas(mes: string, d: number) {
  const dt = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + d, 1));
  return dt.toISOString().slice(0, 7);
}

/**
 * H8 (Vanina 06/10): corte administrativo del mes. Administración controla las historias clínicas y marca los pacientes
 * «listos para facturar»; Facturación los ve, los controla de nuevo y los revisa. No es una baja.
 */
export default async function ListoParaFacturarPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const { profile } = await requireProfile();
  if (!ROLES.includes(profile.role)) redirect("/inicio");
  const supabase = await createClient();

  const hoy = hoyAR();
  const mesActual = hoy.slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesActual;
  const desde = `${mes}-01`;
  const hasta = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const esAdmin = profile.role === "administracion";
  const esFact = profile.role === "facturacion";

  const [{ data: pacientes }, { data: visitas }, { data: pend }, { data: listos }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, nombre_completo, dni, fecha_ingreso, fecha_egreso, estado, obra_social, obras_sociales(nombre)")
      .lte("fecha_ingreso", hasta)
      .or(`fecha_egreso.is.null,fecha_egreso.gte.${desde}`)
      .neq("estado", "admitido_pendiente_llegada")
      .order("nombre_completo"),
    supabase.from("visits").select("patient_id").eq("estado", "realizada").gte("fecha_programada", desde).lte("fecha_programada", hasta),
    supabase.from("v_visit_evolution_discrepancies").select("patient_id").gte("fecha_programada", desde).lte("fecha_programada", hasta),
    supabase.from("billing_ready").select("id, patient_id, marcado_at, nota, revisado_at, marcado_por, revisado_por").eq("periodo", desde),
  ]);

  const contar = (rows: { patient_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.patient_id) m.set(r.patient_id, (m.get(r.patient_id) ?? 0) + 1);
    return m;
  };
  const visPorPac = contar(visitas);
  const pendPorPac = contar(pend);
  const listoPorPac = new Map((listos ?? []).map((l) => [l.patient_id, l]));
  const idsPersonas = [...new Set((listos ?? []).flatMap((l) => [l.marcado_por, l.revisado_por]).filter((x): x is string => !!x))];
  const { data: personas } = idsPersonas.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", idsPersonas) : { data: [] as { id: string; full_name: string }[] };
  const nombre = Object.fromEntries((personas ?? []).map((p) => [p.id, p.full_name]));

  const todos = pacientes ?? [];
  const osDe = (p: (typeof todos)[number]) => (p.obras_sociales as unknown as { nombre: string } | null)?.nombre ?? p.obra_social;
  const sinMarcar: FilaListo[] = todos
    .filter((p) => !listoPorPac.has(p.id))
    .map((p) => ({ patientId: p.id, nombre: p.nombre_completo, dni: p.dni, obraSocial: osDe(p), visitas: visPorPac.get(p.id) ?? 0, pendientes: pendPorPac.get(p.id) ?? 0 }));
  const marcados = todos.filter((p) => listoPorPac.has(p.id));
  const sinRevisar = marcados.filter((p) => !listoPorPac.get(p.id)!.revisado_at);

  const nav = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconCash className="w-5 h-5" />}
        title="Listo para facturar"
        section="DF-C4"
        purpose={
          esAdmin
            ? "Controlá que las historias clínicas del mes estén completas y marcá a cada paciente como «listo para facturar». Facturación lo recibe desde acá."
            : esFact
            ? "Estos son los pacientes que Administración dejó listos. Controlalos de nuevo y marcá la revisión antes de calcular los importes."
            : "Vista de consulta: qué pacientes están listos para facturar este mes."
        }
        description="Corte administrativo mensual: no es una baja del paciente (feedback de Vanina, 06/10)."
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/listo-para-facturar?mes=${mesMas(mes, -1)}`} className={nav}>← {mesLabel(mesMas(mes, -1))}</Link>
        <span className="text-sm font-semibold text-slate-900 capitalize">{mesLabel(mes)}</span>
        {mes < mesActual && <Link href={`/listo-para-facturar?mes=${mesMas(mes, 1)}`} className={nav}>{mesLabel(mesMas(mes, 1))} →</Link>}
        <span className="ml-auto text-xs text-slate-500">{marcados.length} de {todos.length} paciente(s) marcados · {sinRevisar.length} esperan revisión de Facturación</span>
      </div>

      {esAdmin && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Pacientes del mes sin marcar ({sinMarcar.length})</h2>
          <ListoParaFacturarForm mes={mes} filas={sinMarcar} />
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Marcados como listos para facturar ({marcados.length})</h2>
        {marcados.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay pacientes marcados en este mes.</p>
        ) : esFact && sinRevisar.length > 0 ? (
          <form action={marcarRevisadoAction} className="space-y-2">
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {marcados.map((p) => {
                const l = listoPorPac.get(p.id)!;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    {!l.revisado_at ? <input type="checkbox" name="id" value={l.id} defaultChecked className="rounded border-slate-300" aria-label={`Revisar a ${p.nombre_completo}`} /> : <span className="w-4" />}
                    <Fila p={p} os={osDe(p)} l={l} nombre={nombre} visitas={visPorPac.get(p.id) ?? 0} pendientes={pendPorPac.get(p.id) ?? 0} />
                  </li>
                );
              })}
            </ul>
            <button className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800">Registrar la revisión de los tildados</button>
          </form>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {marcados.map((p) => {
              const l = listoPorPac.get(p.id)!;
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <Fila p={p} os={osDe(p)} l={l} nombre={nombre} visitas={visPorPac.get(p.id) ?? 0} pendientes={pendPorPac.get(p.id) ?? 0} />
                  {esAdmin && !l.revisado_at && (
                    <form action={desmarcarListoAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <ConfirmButton className="text-xs text-red-600 underline underline-offset-2" confirmLabel="¿Quitar la marca? Tocá de nuevo">Quitar marca</ConfirmButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {esFact && <Link href="/facturacion" className="inline-flex text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">Ir al cierre mensual por obra social →</Link>}
      </section>
    </div>
  );
}

function Fila({
  p,
  os,
  l,
  nombre,
  visitas,
  pendientes,
}: {
  p: { id: string; nombre_completo: string; dni: string | null };
  os: string | null;
  l: { marcado_at: string; nota: string | null; revisado_at: string | null; marcado_por: string | null; revisado_por: string | null };
  nombre: Record<string, string>;
  visitas: number;
  pendientes: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/paciente/${p.id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{p.nombre_completo}</Link>
        {l.revisado_at ? <StatusBadge tone="verde" label="Revisado por Facturación" /> : <StatusBadge tone="amarillo" label="Espera revisión" />}
        {pendientes > 0 && <StatusBadge tone="rojo" label={`${pendientes} sin evolución`} />}
      </div>
      <div className="text-xs text-slate-500">
        {os ?? "Sin obra social"}{p.dni ? ` · DNI ${p.dni}` : ""} · {visitas} visita(s) · marcado el {fechaCorta(l.marcado_at.slice(0, 10))}{l.marcado_por ? ` por ${nombre[l.marcado_por] ?? "—"}` : ""}
        {l.revisado_at && ` · revisado el ${fechaCorta(l.revisado_at.slice(0, 10))}${l.revisado_por ? ` por ${nombre[l.revisado_por] ?? "—"}` : ""}`}
      </div>
      {l.nota && <div className="text-xs text-amber-700 mt-0.5">Observación: {l.nota}</div>}
    </div>
  );
}
