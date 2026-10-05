import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import TareaCard from "@/components/transporte/TareaCard";
import NuevaTareaForm from "@/components/transporte/NuevaTareaForm";
import { IconCalendar } from "@/components/icons";
import { hoyAR } from "@/lib/plan";
import { fechaCorta } from "@/lib/stock-ui";
import { PRIORIDAD_ORDEN, permanenteCaeEn, sumarDias, minutos, type TareaT } from "@/lib/agenda-transporte";

const ROLES = ["transporte", "deposito", "administracion", "direccion"];

/**
 * Agenda de Transporte: lo que hay que hacer en el día (entregas, retiros y tareas propias),
 * ordenado por prioridad. Depósito, Administración y Dirección la ven; Transporte y Depósito
 * la editan.
 */
export default async function AgendaTransportePage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha: fechaParam } = await searchParams;
  const { profile } = await requireProfile();
  if (!ROLES.includes(profile.role)) redirect("/inicio");
  const supabase = await createClient();

  const hoy = hoyAR();
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoy;
  const esHoy = fecha === hoy;

  const { data } = await supabase
    .from("transport_tasks")
    .select("*, orders(estado)")
    .neq("estado", "cancelada")
    .or(`fecha.eq.${fecha},permanente.eq.true${esHoy ? `,and(fecha.lt.${fecha},estado.in.(pendiente,en_camino))` : ""}`)
    .order("fecha")
    .limit(300);
  const { data: runs } = await supabase.from("transport_task_runs").select("task_id").eq("fecha", fecha);
  const hechas = new Set((runs ?? []).map((r) => r.task_id));

  type Fila = TareaT & { orders: { estado: string } | null };
  const tareas = ((data ?? []) as unknown as Fila[]).filter((t) => {
    if (t.orders && t.orders.estado === "cancelado") return false;
    if (t.permanente) return permanenteCaeEn(t, fecha);
    if (t.fecha === fecha) return true;
    return esHoy && t.fecha < fecha && ["pendiente", "en_camino"].includes(t.estado);
  });

  const cerrada = (t: Fila) => hechas.has(t.id) || t.estado === "completada";
  const orden = (a: Fila, b: Fila) =>
    (PRIORIDAD_ORDEN[a.prioridad] ?? 9) - (PRIORIDAD_ORDEN[b.prioridad] ?? 9) ||
    (a.hora ? minutos(a.hora) : 9999) - (b.hora ? minutos(b.hora) : 9999);
  const pendientes = tareas.filter((t) => !cerrada(t)).sort(orden);
  const hechasHoy = tareas.filter(cerrada).sort(orden);

  const puedeCrear = profile.role === "transporte" || profile.role === "deposito";
  const nav = "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconCalendar className="w-5 h-5" />}
        title="Agenda de Transporte"
        section="DF-C5 §4.4"
        description="Agenda diaria con prioridad en 3 niveles, tareas propias y permanentes, reprogramación con motivo."
        purpose="Lo que hay que entregar, retirar o hacer hoy, ordenado por prioridad."
        action={puedeCrear ? { label: "+ Nueva tarea", href: "#nueva-tarea" } : undefined}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/agenda-transporte?fecha=${sumarDias(fecha, -1)}`} className={nav} aria-label="Día anterior">‹ Anterior</Link>
        <Link href="/agenda-transporte" className={`${nav} ${esHoy ? "bg-slate-900 !text-white" : ""}`}>Hoy</Link>
        <Link href={`/agenda-transporte?fecha=${sumarDias(fecha, 1)}`} className={nav} aria-label="Día siguiente">Siguiente ›</Link>
        <form className="flex items-center gap-2" method="get">
          <input type="date" name="fecha" defaultValue={fecha} className="rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm" aria-label="Ir a un día" />
          <button className={nav}>Ir</button>
        </form>
        <p className="text-sm font-semibold text-slate-800 w-full sm:w-auto sm:ml-2">{esHoy ? "Hoy" : ""} {fechaCorta(fecha)}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Para hacer <span className="text-slate-500 font-normal">({pendientes.length})</span>
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
            No hay tareas pendientes para este día. Los pedidos despachados aparecen acá solos.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendientes.map((t) => <TareaCard key={t.id} t={t} fecha={fecha} rol={profile.role} hecha={false} />)}
          </ul>
        )}
      </section>

      {hechasHoy.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Hechas <span className="text-slate-500 font-normal">({hechasHoy.length})</span>
          </h2>
          <ul className="space-y-3">
            {hechasHoy.map((t) => <TareaCard key={t.id} t={t} fecha={fecha} rol={profile.role} hecha={hechas.has(t.id)} />)}
          </ul>
        </section>
      )}

      {puedeCrear && (
        <SidePanel id="nueva-tarea" title="Nueva tarea">
          <NuevaTareaForm fecha={fecha} />
        </SidePanel>
      )}
    </div>
  );
}
