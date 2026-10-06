import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconMapPin } from "@/components/icons";
import { ordenarPorCercania, urlMapa, urlPunto, urlRuta } from "@/lib/mapa";
import type { AppRole } from "@/lib/roles";

const ROLES_MAPA: AppRole[] = ["coordinador_internacion", "administracion", "direccion"];
const campo = "rounded-xl border border-slate-300 px-3 py-2.5 text-sm";

/**
 * Mapa de pacientes (H13, Vanina 06/10, DF-C1/DF-C2). Todavía no hay clave de Google Maps (tiene costo mensual por uso,
 * DF-C1 pregunta 14): por eso acá se muestra la ubicación capturada de cada paciente con un enlace al mapa y una ruta sugerida
 * por profesional (orden por cercanía). Cuando exista la clave, esta pantalla pasa a mostrar el mapa global con color por profesional.
 */
export default async function MapaPage({ searchParams }: { searchParams: Promise<{ prof?: string }> }) {
  const { prof } = await searchParams;
  const { profile } = await requireProfile();
  if (!ROLES_MAPA.includes(profile.role)) redirect("/inicio");
  const supabase = await createClient();

  const [{ data: pacientes }, { data: equipo }, { data: profes }] = await Promise.all([
    supabase.from("patients").select("id, nombre_completo, domicilio, localidad, lat, lng, estado, llegada_confirmada_at").in("estado", ["activo", "admitido_pendiente_llegada"]).order("nombre_completo"),
    supabase.from("patient_care_team").select("patient_id, profesional_id, especialidad"),
    supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name"),
  ]);
  const nombreProf = new Map((profes ?? []).map((p) => [p.id, p.full_name]));
  const elegido = prof && nombreProf.has(prof) ? prof : "";
  const delEquipo = (id: string) => (equipo ?? []).filter((t) => t.patient_id === id);
  const lista = (pacientes ?? []).filter((p) => !elegido || delEquipo(p.id).some((t) => t.profesional_id === elegido));
  const sinUbicacion = lista.filter((p) => p.lat == null || p.lng == null);
  const orden = ordenarPorCercania(lista);
  const ruta = elegido ? urlRuta(orden.map((p) => ({ lat: p.lat, lng: p.lng, domicilio: p.domicilio }))) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconMapPin className="w-5 h-5" />}
        title="Mapa de pacientes"
        section="DF-C1 / DF-C2 (H13)"
        purpose="Dónde está cada paciente según la ubicación capturada en el domicilio, y una ruta sugerida para cada profesional."
        description="Versión sin clave de Google Maps: enlaces al mapa y orden de recorrido por cercanía (feedback de Vanina, 06/10)."
      />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Profesional</span>
          <select name="prof" defaultValue={elegido} className={`${campo} mt-1 block`}>
            <option value="">Todos los pacientes</option>
            {(profes ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800">Ver</button>
        {ruta && (
          <a href={ruta} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium px-4 py-2.5 hover:bg-slate-50">
            Abrir ruta sugerida en el mapa
          </a>
        )}
      </form>

      {sinUbicacion.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {sinUbicacion.length} paciente(s) todavía sin ubicación capturada. La ubicación se toma cuando el profesional inicia una visita o en el alta con el celular; mientras tanto el enlace usa el domicilio escrito.
        </div>
      )}

      {orden.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">No hay pacientes para mostrar.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                {elegido && <th className="text-left px-4 py-2.5 font-medium">Orden</th>}
                <th className="text-left px-4 py-2.5 font-medium">Paciente</th>
                <th className="text-left px-4 py-2.5 font-medium">Domicilio</th>
                <th className="text-left px-4 py-2.5 font-medium">Equipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orden.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  {elegido && <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>}
                  <td className="px-4 py-2.5">
                    <Link href={`/paciente/${p.id}`} className="text-slate-900 hover:underline underline-offset-2">{p.nombre_completo}</Link>
                    {p.estado === "admitido_pendiente_llegada" && <span className="ml-2"><StatusBadge tone="amarillo" label="Ingreso nuevo" /></span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.domicilio ?? "—"}{p.localidad ? ` · ${p.localidad}` : ""}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {delEquipo(p.id).map((t) => `${nombreProf.get(t.profesional_id) ?? "—"} (${SPECIALTY_LABELS[t.especialidad] ?? t.especialidad})`).join(", ") || <span className="text-rose-700">Sin equipo asignado</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.lat != null && p.lng != null ? (
                      <a href={urlPunto(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-teal-700">Ver en el mapa</a>
                    ) : p.domicilio ? (
                      <a href={urlMapa(p.domicilio)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-slate-500">Sin capturar · ver domicilio</a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
