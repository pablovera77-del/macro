import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ConfirmButton from "@/components/ConfirmButton";
import ActionDisclosure from "@/components/ActionDisclosure";
import ProgramarGuardiasForm from "@/components/guardias/ProgramarGuardiasForm";
import { IconAlert, IconClock } from "@/components/icons";
import { hoyAR, ymdAR, TZ } from "@/lib/plan";
import { ROLES_GUARDIAS, HORAS_TURNO_ABIERTO, turnosOlvidados, limitesDelMes, mesValido, mesVecino } from "@/lib/guardias";
import { asignarProfesionalGuardiaAction, quitarGuardiaAction } from "./actions";

const ROLES_VER = [...ROLES_GUARDIAS, "direccion"] as const;
const campo = "rounded-lg border border-slate-300 px-2 py-1.5 text-xs";
const hora = (t: string) => t.slice(0, 5);
const fechaLarga = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const mesLargo = (mes: string) => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", month: "long", year: "numeric" });

/**
 * Guardias del mes (H12, Vanina 06/10, DF-C2): agenda mensual de guardias, asignación por tramos de la semana o por día y cantidad,
 * y alerta de turnos de guardia abiertos. Lo programado vive en `guardias_programadas`; lo realizado, en `turno_guardia`.
 */
export default async function GuardiasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const { profile } = await requireProfile();
  if (!(ROLES_VER as readonly string[]).includes(profile.role)) redirect("/inicio");
  const puedeEditar = ROLES_GUARDIAS.includes(profile.role);
  const supabase = await createClient();
  const hoy = hoyAR();
  const mes = mesValido(mesParam) ? (mesParam as string) : hoy.slice(0, 7);
  const { desde, hasta } = limitesDelMes(mes);

  const [{ data: guardias }, { data: turnos }, { data: abiertos }, { data: pacientes }, { data: profes }] = await Promise.all([
    supabase.from("guardias_programadas").select("id, patient_id, profesional_id, fecha, desde, hasta, nota").gte("fecha", desde).lte("fecha", hasta).order("fecha").order("desde"),
    supabase.from("turno_guardia").select("patient_id, profesional_id, hora_ingreso").gte("hora_ingreso", `${desde}T00:00:00-03:00`).lt("hora_ingreso", `${hasta}T23:59:59-03:00`),
    supabase.from("turno_guardia").select("id, patient_id, profesional_id, hora_ingreso").eq("estado", "abierto").order("hora_ingreso"),
    supabase.from("patients").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo"),
    supabase.from("profiles").select("id, full_name").eq("role", "profesional_asistencial").eq("active", true).order("full_name"),
  ]);
  const pac = new Map((pacientes ?? []).map((p) => [p.id, p.nombre_completo]));
  const nombreProf = new Map((profes ?? []).map((p) => [p.id, p.full_name]));
  const hechas = new Set((turnos ?? []).map((t) => `${t.patient_id}|${t.profesional_id}|${ymdAR(t.hora_ingreso)}`));
  const olvidados = turnosOlvidados(abiertos ?? []);
  const sinProfesional = (guardias ?? []).filter((g) => !g.profesional_id && g.fecha >= hoy);

  const porDia = new Map<string, NonNullable<typeof guardias>>();
  for (const g of guardias ?? []) porDia.set(g.fecha, [...(porDia.get(g.fecha) ?? []), g]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconClock className="w-5 h-5" />}
        title="Guardias del mes"
        section="DF-C2 (H12)"
        purpose="Armá las guardias del mes por tramos de la semana o por día y cantidad, y mirá cuáles quedaron sin profesional o sin registrar."
        description="Agenda mensual de guardias (feedback de Vanina, 06/10). Reutiliza el turno de guardia que registra el profesional."
      />

      {olvidados.length > 0 && (
        <section className="bg-rose-50 border border-rose-300 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <IconAlert className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-semibold text-rose-900">Turnos de guardia abiertos hace más de {HORAS_TURNO_ABIERTO} horas ({olvidados.length})</h2>
          </div>
          <ul className="text-sm text-rose-900 space-y-1">
            {olvidados.map((t) => (
              <li key={t.id}>
                {nombreProf.get(t.profesional_id) ?? "Profesional"} en <Link href={`/paciente/${t.patient_id}`} className="underline underline-offset-2">{pac.get(t.patient_id) ?? "paciente"}</Link>
                {" "}— ingresó el {new Date(t.hora_ingreso).toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} y todavía no cerró el turno.
              </li>
            ))}
          </ul>
        </section>
      )}

      {sinProfesional.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          Hay <strong>{sinProfesional.length}</strong> guardia(s) de hoy en adelante todavía sin profesional asignado en este mes.
        </section>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={`/guardias?mes=${mesVecino(mes, -1)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">← Mes anterior</Link>
          <h2 className="text-base font-semibold text-slate-900 capitalize px-2">{mesLargo(mes)}</h2>
          <Link href={`/guardias?mes=${mesVecino(mes, 1)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Mes siguiente →</Link>
        </div>
        <div className="text-xs text-slate-500">{(guardias ?? []).length} guardia(s) cargada(s)</div>
      </div>

      {puedeEditar && (
        <ActionDisclosure label="+ Cargar guardias" tone="default">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <ProgramarGuardiasForm
              pacientes={(pacientes ?? []).map((p) => ({ id: p.id, nombre: p.nombre_completo }))}
              profesionales={(profes ?? []).map((p) => ({ id: p.id, nombre: p.full_name }))}
              hoy={hoy}
            />
          </div>
        </ActionDisclosure>
      )}

      {porDia.size === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">No hay guardias cargadas para este mes.</div>
      ) : (
        <div className="space-y-3">
          {[...porDia.entries()].map(([fecha, lista]) => (
            <section key={fecha} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <h3 className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide capitalize ${fecha === hoy ? "bg-teal-50 text-teal-800" : "bg-slate-50 text-slate-500"}`}>{fechaLarga(fecha)}{fecha === hoy ? " · hoy" : ""}</h3>
              <ul className="divide-y divide-slate-100">
                {lista.map((g) => {
                  const cumplida = g.profesional_id ? hechas.has(`${g.patient_id}|${g.profesional_id}|${g.fecha}`) : false;
                  const pasada = g.fecha < hoy;
                  return (
                    <li key={g.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-slate-500 text-xs w-24">{hora(g.desde)} a {hora(g.hasta)}</span>
                      <Link href={`/paciente/${g.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">{pac.get(g.patient_id) ?? "Paciente"}</Link>
                      {g.profesional_id ? (
                        <span className="text-slate-600">{nombreProf.get(g.profesional_id) ?? "Profesional"}</span>
                      ) : puedeEditar ? (
                        <form action={asignarProfesionalGuardiaAction} className="flex gap-2">
                          <input type="hidden" name="id" value={g.id} />
                          <select name="profesional_id" required defaultValue="" className={campo}>
                            <option value="" disabled>Asignar profesional…</option>
                            {(profes ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                          </select>
                          <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800">Asignar</button>
                        </form>
                      ) : null}
                      {!g.profesional_id && <StatusBadge tone="rojo" label="Sin profesional" />}
                      {g.profesional_id && cumplida && <StatusBadge tone="verde" label="Turno registrado" />}
                      {g.profesional_id && !cumplida && pasada && <StatusBadge tone="amarillo" label="Sin registro del turno" />}
                      {g.nota && <span className="text-xs text-slate-400">{g.nota}</span>}
                      {puedeEditar && (
                        <form action={quitarGuardiaAction} className="ml-auto">
                          <input type="hidden" name="id" value={g.id} />
                          <ConfirmButton className="text-xs text-slate-500 hover:text-red-700">Quitar</ConfirmButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
