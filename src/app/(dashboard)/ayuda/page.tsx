import Link from "next/link";
import { requireProfile, ROLE_LABELS } from "@/lib/auth";
import { TASKS_BY_ROLE } from "@/lib/home-tasks";
import PageHeader from "@/components/PageHeader";
import { PERMISOS, SOLO_LECTURA } from "@/lib/permissions";
import type { AppRole } from "@/lib/roles";
import { IconStethoscope, IconArrowRight } from "@/components/icons";

export default async function AyudaPage() {
  const { profile } = await requireProfile();
  const tasks = TASKS_BY_ROLE[profile.role];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconStethoscope className="w-5 h-5" />}
        title="Guía de uso"
        badge={ROLE_LABELS[profile.role]}
        purpose="Acá está, paso a paso, cómo hacer cada tarea que te corresponde en el sistema. Tocá una tarea para ver los pasos y el botón que te lleva directo a la pantalla."
      />

      <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-900 space-y-1.5 animate-fade-slide-up">
        <p className="font-semibold">Tres cosas para ubicarte en cualquier pantalla</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Arriba de cada pantalla hay una frase que explica para qué sirve.</li>
          <li>Si podés crear algo, vas a ver un botón verde arriba a la derecha (por ejemplo «+ Nuevo paciente»).</li>
          <li>Los colores son siempre los mismos: verde = bien, amarillo = atención, rojo = urgente, gris = sin acción.</li>
        </ul>
      </section>

      <section className="space-y-3 animate-fade-slide-up">
        {tasks.map((t) => (
          <details key={t.id} className="group bg-white rounded-2xl border border-slate-200 p-5 card-hover">
            <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3">
              <span>
                <span className="font-semibold text-slate-900">{t.title}</span>
                <span className="block text-sm text-slate-600 mt-0.5">{t.summary}</span>
              </span>
              <span className="text-xs text-slate-400 shrink-0">Ver pasos ▾</span>
            </summary>
            <ol className="mt-3 space-y-1.5 text-sm text-slate-700 list-decimal pl-5">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <Link
                href={t.href}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors"
              >
                {t.cta} <IconArrowRight className="w-3.5 h-3.5" />
              </Link>
              {process.env.NEXT_PUBLIC_SHOW_TRACE === "1" && <span className="text-[11px] text-slate-400">Relevado en {t.doc}</span>}
            </div>
          </details>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Quién puede hacer qué</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Si un botón no te aparece, es porque esa tarea le corresponde a otro rol. Tu columna está marcada.
          </p>
          <p className="text-xs text-slate-600 mt-2">
            <strong>Vos podés ver:</strong> {SOLO_LECTURA[profile.role]}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Tarea</th>
                {COLUMNAS.map((r) => (
                  <th key={r} className={`px-2 py-2.5 font-medium text-center ${r === profile.role ? "bg-emerald-50 text-emerald-800" : ""}`}>
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISOS.map((p, i) => (
                <tr key={p.accion}>
                  <td className="px-4 py-2 text-slate-800">
                    {(i === 0 || PERMISOS[i - 1].modulo !== p.modulo) && (
                      <span className="block text-[10px] uppercase tracking-wide text-slate-400">{p.modulo}</span>
                    )}
                    {p.accion}
                  </td>
                  {COLUMNAS.map((r) => (
                    <td key={r} className={`px-2 py-2 text-center ${r === profile.role ? "bg-emerald-50/60" : ""}`}>
                      {p.roles.includes(r) ? <span className="text-emerald-600 font-semibold" aria-label="puede">✓</span> : <span className="text-slate-300" aria-label="no puede">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const COLUMNAS: AppRole[] = ["administracion", "coordinador_internacion", "profesional_asistencial", "deposito", "transporte", "direccion"];
