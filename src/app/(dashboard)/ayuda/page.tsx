import Link from "next/link";
import { requireProfile, ROLE_LABELS } from "@/lib/auth";
import { TASKS_BY_ROLE } from "@/lib/home-tasks";
import PageHeader from "@/components/PageHeader";
import { IconStethoscope, IconArrowRight } from "@/components/icons";

export default async function AyudaPage() {
  const { profile } = await requireProfile();
  const tasks = TASKS_BY_ROLE[profile.role];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconStethoscope className="w-5 h-5" />}
        title="Guía de uso"
        section={ROLE_LABELS[profile.role]}
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
              <span className="text-[11px] text-slate-400">Relevado en {t.doc}</span>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
