import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconClipboardCheck } from "@/components/icons";

// F4: registro de quién cambió qué y cuándo, solo para Dirección. Lo escriben
// triggers de base de datos (no la aplicación), así que no se puede olvidar ni saltear.
// El contenido clínico de las evoluciones nunca se guarda en este registro.

const ENTIDADES: Record<string, string> = {
  patients: "Pacientes",
  visits: "Visitas",
  orders: "Pedidos",
  patient_authorizations: "Autorizaciones de stock",
  patient_care_team: "Equipo asistencial",
  treatment_plans: "Plan de tratamiento",
  patient_medications: "Medicación",
  patient_document_signatures: "Consentimientos firmados",
  evolutions: "Evoluciones (sin contenido clínico)",
};
const ACCIONES: Record<string, string> = { insert: "Alta", update: "Modificación", delete: "Baja" };
const ACCION_STYLE: Record<string, string> = {
  insert: "bg-emerald-100 text-emerald-700",
  update: "bg-amber-100 text-amber-700",
  delete: "bg-red-100 text-red-700",
};
// Campos que cambian siempre y no aportan información al leer el registro.
const RUIDO = new Set(["updated_at", "created_at"]);

type Json = Record<string, unknown> | null;

function resumen(accion: string, antes: Json, despues: Json): string {
  if (accion === "update" && antes && despues) {
    const cambios = Object.keys(despues)
      .filter((k) => !RUIDO.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
      .map((k) => `${k}: ${fmt(antes[k])} → ${fmt(despues[k])}`);
    return cambios.join(" · ") || "Sin cambios visibles";
  }
  const fila = (accion === "delete" ? antes : despues) ?? {};
  const nombre = (fila.nombre_completo ?? fila.especialidad ?? fila.estado ?? "") as string;
  return nombre ? String(nombre) : "—";
}
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vacío";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; accion?: string; usuario?: string; desde?: string; hasta?: string }>;
}) {
  const { profile } = await requireProfile();
  if (profile.role !== "direccion") redirect("/inicio");
  const { entidad, accion, usuario, desde, hasta } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("audit_log")
    .select("id, created_at, accion, entidad, entidad_id, payload_antes, payload_despues, user_id, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (entidad && ENTIDADES[entidad]) q = q.eq("entidad", entidad);
  if (accion && ACCIONES[accion]) q = q.eq("accion", accion);
  if (usuario) q = q.eq("user_id", usuario);
  if (desde) q = q.gte("created_at", `${desde}T00:00:00-03:00`);
  if (hasta) q = q.lt("created_at", `${hasta}T23:59:59-03:00`);

  const [{ data: filas }, { data: personas }] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconClipboardCheck className="w-5 h-5" />}
        title="Auditoría"
        section="DF-C1 §4.1"
        purpose="Quién hizo cada cambio importante y cuándo: altas, planes, medicación, consentimientos, pedidos y evoluciones. Se registra solo, no se puede editar."
        description="audit_log alimentado por triggers; evoluciones sin contenido clínico."
      />

      <form method="get" className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <label className="text-xs text-slate-500 col-span-1">
          Qué
          <select name="entidad" defaultValue={entidad ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900">
            <option value="">Todo</option>
            {Object.entries(ENTIDADES).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Acción
          <select name="accion" defaultValue={accion ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900">
            <option value="">Todas</option>
            {Object.entries(ACCIONES).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Quién
          <select name="usuario" defaultValue={usuario ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900">
            <option value="">Cualquiera</option>
            {(personas ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Desde
          <input type="date" name="desde" defaultValue={desde ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
        <label className="text-xs text-slate-500">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
        <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors">Filtrar</button>
      </form>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
          {(filas ?? []).length === 200 ? "Últimos 200 movimientos (acotá con los filtros para ver otros)." : `${(filas ?? []).length} movimientos`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Cuándo</th>
                <th className="text-left px-4 py-2.5 font-medium">Quién</th>
                <th className="text-left px-4 py-2.5 font-medium">Acción</th>
                <th className="text-left px-4 py-2.5 font-medium">Qué</th>
                <th className="text-left px-4 py-2.5 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(filas ?? []).map((f) => (
                <tr key={f.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                    {new Date(f.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/San_Juan", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-slate-900">{(f.profiles as unknown as { full_name: string } | null)?.full_name ?? "Sistema"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${ACCION_STYLE[f.accion] ?? "bg-slate-100 text-slate-600"}`}>{ACCIONES[f.accion] ?? f.accion}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{ENTIDADES[f.entidad] ?? f.entidad}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-md break-words">
                    {resumen(f.accion, f.payload_antes as Json, f.payload_despues as Json)}
                  </td>
                </tr>
              ))}
              {(filas ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-xs">No hay movimientos con estos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
