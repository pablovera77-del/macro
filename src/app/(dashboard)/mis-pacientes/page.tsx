import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconUsers, IconMapPin, IconClock } from "@/components/icons";
import { frecuenciaTexto } from "@/lib/autorizaciones";
import { TZ } from "@/lib/plan";
import { telHref, urlMapa } from "@/lib/mapa";
import { atenderPacienteAction } from "./actions";

type Frecuencia = {
  practica: string;
  aclaracion: string | null;
  cantidad: number | null;
  unidad: string | null;
  periodo: string | null;
  dias_semana: number[] | null;
  desde: string;
  hasta: string;
};

const fechaCorta = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", day: "numeric", month: "short" });
const fechaHora = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ, day: "numeric", month: "short" });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Mis pacientes (acordado con Vanina el 20/10): la lista de pacientes asignados al profesional, con sus datos y la
 * frecuencia autorizada. No es una agenda ni lleva contador: sirve para encontrar al paciente, atenderlo cuando
 * corresponde y completar la evolución con la firma de conformidad de la familia.
 * Los datos salen de `fn_mis_pacientes`, que solo devuelve los pacientes del equipo del propio profesional.
 */
export default async function MisPacientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") redirect("/inicio");
  const { q } = await searchParams;
  const busqueda = norm((q ?? "").trim());

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_mis_pacientes");
  const todos = data ?? [];
  const pacientes = busqueda ? todos.filter((p) => norm(`${p.nombre_completo} ${p.dni}`).includes(busqueda)) : todos;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconUsers className="h-6 w-6" />}
        title="Mis pacientes"
        section="DF-C2 · agenda de profesionales sin coordinador"
        purpose="Los pacientes que te asignaron, con sus datos y la frecuencia autorizada. Tocá «Atender hoy» cuando vayas a verlo y después cargás la evolución con la firma de la familia."
      />

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2" action="/mis-pacientes" method="get">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o DNI"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm w-64 max-w-full"
            aria-label="Buscar paciente"
          />
          <button className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium">Buscar</button>
        </form>
        <Link href="/internacion" className="text-sm underline underline-offset-2 text-slate-600">
          Informar un egreso
        </Link>
      </div>

      {error && <p className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">No pudimos cargar tu lista de pacientes. Probá de nuevo en unos minutos.</p>}

      {!error && pacientes.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white text-sm text-slate-600 px-4 py-6">
          {busqueda
            ? "No encontramos ningún paciente con ese dato."
            : "Todavía no tenés pacientes asignados. Cuando Administración o Coordinación te asignen uno, aparece acá."}
        </p>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {pacientes.map((p) => {
          const frecuencias = (Array.isArray(p.frecuencias) ? p.frecuencias : []) as unknown as Frecuencia[];
          const tel = telHref(p.telefono);
          return (
            <li key={p.patient_id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{p.nombre_completo}</h2>
                  <p className="text-xs text-slate-500">
                    DNI {p.dni}
                    {p.obra_social ? ` · ${p.obra_social}${p.numero_afiliado ? ` (afiliado ${p.numero_afiliado})` : ""}` : ""}
                  </p>
                </div>
                <StatusBadge tone="gris" label={SPECIALTY_LABELS[p.especialidad] ?? p.especialidad} />
              </div>

              <div className="space-y-1 text-sm text-slate-700">
                <a href={urlMapa(`${p.domicilio}${p.localidad ? `, ${p.localidad}` : ""}`)} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 underline-offset-2 hover:underline">
                  <IconMapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {p.domicilio}
                    {p.localidad ? ` · ${p.localidad}` : ""}
                  </span>
                </a>
                {p.telefono && (
                  <p>
                    Teléfono:{" "}
                    {tel ? (
                      <a href={tel} className="underline underline-offset-2">
                        {p.telefono}
                      </a>
                    ) : (
                      p.telefono
                    )}
                  </p>
                )}
                {p.diagnostico_principal && <p className="text-slate-600">Diagnóstico: {p.diagnostico_principal}</p>}
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs font-medium text-slate-500 mb-1">Frecuencia autorizada</p>
                {frecuencias.length === 0 ? (
                  <p className="text-slate-500">Sin autorización vigente cargada. Consultá con Administración.</p>
                ) : (
                  <ul className="space-y-1">
                    {frecuencias.map((f, i) => (
                      <li key={i} className="text-slate-800">
                        <span className="font-medium">{f.practica}</span>
                        {f.aclaracion ? ` (${f.aclaracion})` : ""}:{" "}
                        {frecuenciaTexto({ frecuencia_cantidad: f.cantidad, frecuencia_unidad: f.unidad, frecuencia_periodo: f.periodo, dias_semana: f.dias_semana }) ?? "frecuencia sin detallar"}
                        <span className="text-xs text-slate-500"> · hasta el {fechaCorta(f.hasta)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <IconClock className="h-3.5 w-3.5" />
                  {p.ultima_atencion ? `Última atención: ${fechaHora(p.ultima_atencion)}` : "Sin atenciones registradas"}
                </p>
                {p.visita_hoy ? (
                  <Link href="/agenda" className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium">
                    Ver la visita de hoy
                  </Link>
                ) : (
                  <form action={atenderPacienteAction}>
                    <input type="hidden" name="patient_id" value={p.patient_id} />
                    <button className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium">Atender hoy</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
