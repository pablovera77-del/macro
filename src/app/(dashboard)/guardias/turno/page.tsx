import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { IconClock } from "@/components/icons";
import { AbrirTurnoForm, ControlForm, CerrarTurnoForm } from "@/components/guardias/TurnoGuardiaForms";
import { hoyAR, TZ } from "@/lib/plan";
import { HORAS_TURNO_ABIERTO, ventanaGuardiaKine } from "@/lib/guardias";

const hora = (t: string) => t.slice(0, 5);
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const si = (v: boolean | null) => (v === null ? "—" : v ? "Sí" : "No");

/**
 * Mi guardia (DF-C2 pregunta 1): el profesional abre el turno en el domicilio, anota los controles
 * (P/A, FC, FR, AX, diuresis, catarsis) y lo cierra con su firma y la conformidad de la familia.
 */
export default async function MiGuardiaPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "profesional_asistencial") redirect(profile.role === "coordinador_internacion" || profile.role === "administracion" || profile.role === "direccion" ? "/guardias" : "/inicio");
  const supabase = await createClient();
  const hoy = hoyAR();
  const ayer = new Date(new Date(`${hoy}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);

  // Guardia de kinesiología de fin de semana: la ventana va de lunes a lunes alrededor del sábado.
  const { data: kineProgramadas } = await supabase
    .from("guardias_kine_fin_de_semana")
    .select("id, sabado")
    .eq("profesional_id", profile.id)
    .gte("sabado", new Date(new Date(`${hoy}T12:00:00Z`).getTime() - 2 * 86400000).toISOString().slice(0, 10))
    .lte("sabado", new Date(new Date(`${hoy}T12:00:00Z`).getTime() + 5 * 86400000).toISOString().slice(0, 10));
  const kineVigente = (kineProgramadas ?? []).find((g) => {
    const v = ventanaGuardiaKine(g.sabado);
    return hoy >= v.desde && hoy <= v.hasta;
  });
  let pacientesKine: { id: string; nombre_completo: string; domicilio: string; telefono_contacto: string | null; contacto_familiar_telefono: string | null; diagnostico_principal: string | null }[] = [];
  if (kineVigente) {
    const [{ data: planes }, { data: equipo }] = await Promise.all([
      supabase.from("treatment_plans").select("patient_id").eq("especialidad", "kinesiologia").eq("activo", true),
      supabase.from("patient_care_team").select("patient_id").eq("especialidad", "kinesiologia"),
    ]);
    const ids = [...new Set([...(planes ?? []).map((x) => x.patient_id), ...(equipo ?? []).map((x) => x.patient_id)])];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("patients")
        .select("id, nombre_completo, domicilio, telefono_contacto, contacto_familiar_telefono, diagnostico_principal")
        .in("id", ids)
        .eq("estado", "activo")
        .order("nombre_completo");
      pacientesKine = data ?? [];
    }
  }

  const [{ data: abiertos }, { data: programadas }, { data: perfil }] = await Promise.all([
    supabase
      .from("turno_guardia")
      .select("id, patient_id, hora_ingreso, patients(nombre_completo, domicilio), turno_guardia_controles(id, hora, pa, fc, fr, ax, diuresis, catarsis)")
      .eq("profesional_id", profile.id)
      .eq("estado", "abierto")
      .order("hora_ingreso"),
    supabase
      .from("guardias_programadas")
      .select("id, patient_id, fecha, desde, hasta, nota, patients(nombre_completo, domicilio)")
      .eq("profesional_id", profile.id)
      .gte("fecha", ayer)
      .lte("fecha", hoy)
      .order("fecha")
      .order("desde"),
    supabase.from("profiles").select("matricula").eq("id", profile.id).maybeSingle(),
  ]);

  const abiertosPac = new Set((abiertos ?? []).map((t) => t.patient_id));
  const porIniciar = (programadas ?? []).filter((g) => !abiertosPac.has(g.patient_id));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconClock className="w-5 h-5" />}
        title="Mi guardia"
        section="DF-C2 §5"
        purpose="Abrí tu turno al llegar al domicilio, anotá los controles que hacés y cerralo con tu firma y la conformidad de la familia."
        description={`Si dejás un turno abierto más de ${HORAS_TURNO_ABIERTO} horas, Coordinación recibe una alerta.`}
      />

      {(abiertos ?? []).map((t) => {
        const pac = t.patients as unknown as { nombre_completo: string; domicilio: string } | null;
        const controles = ((t.turno_guardia_controles as unknown as { id: string; hora: string; pa: string | null; fc: number | null; fr: number | null; ax: number | null; diuresis: boolean | null; catarsis: boolean | null }[]) ?? []).sort((a, b) => a.hora.localeCompare(b.hora));
        return (
          <section key={t.id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <Link href={`/paciente/${t.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{pac?.nombre_completo ?? "Paciente"}</Link>
                <div className="text-xs text-slate-500">{pac?.domicilio}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Ingresaste {fechaHora(t.hora_ingreso)}</div>
              </div>
              <StatusBadge tone="amarillo" label="Turno abierto" />
            </div>

            {controles.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-3 font-medium">Hora</th><th className="pr-3 font-medium">P/A</th><th className="pr-3 font-medium">FC</th><th className="pr-3 font-medium">FR</th><th className="pr-3 font-medium">AX</th><th className="pr-3 font-medium">Diuresis</th><th className="font-medium">Catarsis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controles.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100 text-slate-800">
                        <td className="py-1 pr-3">{new Date(c.hora).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="pr-3">{c.pa ?? "—"}</td><td className="pr-3">{c.fc ?? "—"}</td><td className="pr-3">{c.fr ?? "—"}</td><td className="pr-3">{c.ax ?? "—"}</td><td className="pr-3">{si(c.diuresis)}</td><td>{si(c.catarsis)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ControlForm turnoId={t.id} />
            <CerrarTurnoForm turnoId={t.id} matriculaInicial={perfil?.matricula ?? null} profesionalNombre={profile.full_name} />
          </section>
        );
      })}

      {porIniciar.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-sm font-medium text-slate-900">Guardias programadas para vos</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {porIniciar.map((g) => {
              const pac = g.patients as unknown as { nombre_completo: string; domicilio: string } | null;
              return (
                <li key={g.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">{pac?.nombre_completo ?? "Paciente"}</div>
                    <div className="text-xs text-slate-500">{g.fecha === hoy ? "Hoy" : "Ayer"} · {hora(g.desde)} a {hora(g.hasta)} · {pac?.domicilio}</div>
                    {g.nota && <div className="text-xs text-slate-400">{g.nota}</div>}
                  </div>
                  <AbrirTurnoForm patientId={g.patient_id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {kineVigente && (
        <section className="bg-white rounded-2xl border border-teal-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-medium text-slate-900">Guardia de kinesiología de fin de semana</h2>
            <StatusBadge tone="verde" label={`${pacientesKine.length} paciente(s) de kinesiología`} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Tenés la guardia de este fin de semana: ves a todos los pacientes de kinesiología, de lunes a lunes ({ventanaGuardiaKine(kineVigente.sabado).desde.split("-").reverse().join("/")} al {ventanaGuardiaKine(kineVigente.sabado).hasta.split("-").reverse().join("/")}).</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {pacientesKine.map((p) => (
              <li key={p.id} className="py-2.5 text-sm flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link href={`/paciente/${p.id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{p.nombre_completo}</Link>
                  <div className="text-xs text-slate-500">{p.domicilio}{p.diagnostico_principal ? ` · ${p.diagnostico_principal}` : ""}</div>
                </div>
                {(p.contacto_familiar_telefono ?? p.telefono_contacto) && <span className="text-xs text-slate-500">Tel. {p.contacto_familiar_telefono ?? p.telefono_contacto}</span>}
              </li>
            ))}
            {pacientesKine.length === 0 && <li className="py-2 text-xs text-slate-500">Todavía no hay pacientes con kinesiología en su plan o equipo.</li>}
          </ul>
        </section>
      )}

      {(abiertos ?? []).length === 0 && porIniciar.length === 0 && !kineVigente && (
        <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-5">No tenés guardias programadas para hoy. Coordinación las arma desde «Guardias del mes».</p>
      )}
    </div>
  );
}
