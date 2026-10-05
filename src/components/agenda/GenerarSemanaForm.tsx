import Link from "next/link";
import { generarVisitasSemanaAction } from "@/app/(dashboard)/agenda/actions";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { FRANJAS } from "@/lib/horario";
import { TZ } from "@/lib/plan";
import type { Propuesta } from "@/lib/agenda-semana";

const diaTxt = (ymd: string) => new Date(`${ymd}T12:00:00-03:00`).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" });

/**
 * Vista previa de las visitas que el plan de tratamiento pide y todavía no están en la agenda
 * (esta semana, desde hoy, y la próxima). Coordinación destilda lo que no quiere y confirma.
 */
export default function GenerarSemanaForm({
  propuestas,
  nombres,
  profesionales,
}: {
  propuestas: Propuesta[];
  nombres: Map<string, string>;
  profesionales: Map<string, string>;
}) {
  if (propuestas.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Está todo al día: no hay visitas del plan de tratamiento por programar esta semana ni la próxima.
      </div>
    );
  }
  const grupos = [
    { titulo: "Esta semana (desde hoy)", items: propuestas.filter((p) => p.semana === 0) },
    { titulo: "Semana próxima", items: propuestas.filter((p) => p.semana === 1) },
  ].filter((g) => g.items.length > 0);
  const sinProfesional = propuestas.filter((p) => !p.profesional_id).length;

  return (
    <form action={generarVisitasSemanaAction} className="space-y-4">
      <p className="text-sm text-slate-600">
        Estas son las visitas que el plan de cada paciente pide y todavía no están programadas. Destildá las que no quieras y confirmá: se crean para el profesional asignado a cada disciplina.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Horario de las visitas que se crean</span>
        <select name="horario_lote" defaultValue="sin_hora" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
          <option value="sin_hora">Sin hora definida (solo el día)</option>
          {Object.entries(FRANJAS).map(([k, f]) => (
            <option key={k} value={k}>
              {f.label} ({f.resumen})
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">Después podés cambiar el horario de cada una con «Reprogramar».</span>
      </label>

      {grupos.map((g) => (
        <div key={g.titulo}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            {g.titulo} · {g.items.length}
          </h3>
          <ul className="space-y-2">
            {g.items.map((p) => (
              <li key={p.key}>
                <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${p.profesional_id ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`}>
                  <input type="checkbox" name="item" value={p.key} defaultChecked={!!p.profesional_id} disabled={!p.profesional_id} className="mt-1 h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">{nombres.get(p.patient_id) ?? "Paciente"}</span>
                    <span className="block text-slate-600">
                      {diaTxt(p.ymd)} · {SPECIALTY_LABELS[p.especialidad] ?? p.especialidad}
                    </span>
                    {p.profesional_id ? (
                      <span className="block text-xs text-slate-500">{profesionales.get(p.profesional_id)}</span>
                    ) : (
                      <span className="block text-xs text-amber-800">Sin profesional asignado en esta disciplina</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {sinProfesional > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {sinProfesional === 1 ? "Hay 1 visita sin profesional asignado" : `Hay ${sinProfesional} visitas sin profesional asignado`}: no se pueden crear hasta que armes el equipo del paciente en{" "}
          <Link href="/internacion" className="underline underline-offset-2 font-medium">
            Pacientes
          </Link>
          .
        </p>
      )}
      <button className="w-full rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-3 hover:bg-slate-800 transition-colors">Crear las visitas marcadas</button>
    </form>
  );
}
