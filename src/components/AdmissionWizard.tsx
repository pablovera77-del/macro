"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createAdmissionAction, checkDniAction, type AdmissionState } from "@/app/(dashboard)/internacion/actions";
import { DISCIPLINAS_PLAN, DIAS_CORTOS, hoyAR } from "@/lib/plan";
import { SPECIALTY_LABELS } from "@/lib/roles";

type ObraSocial = { id: string; nombre: string };
type Profesional = { id: string; full_name: string };

const STEPS = [
  { n: 1, title: "Datos personales", hint: "DNI, nombre, domicilio y familiar responsable" },
  { n: 2, title: "Obra social", hint: "Cobertura, afiliado y médico derivante" },
  { n: 3, title: "Diagnóstico, plan y equipo", hint: "Motivo de la internación, visitas por disciplina y profesionales" },
];
// Los pasos 4 a 6 del DF-C3 §3 se completan en la ficha, con el paciente ya admitido.
const PASOS_POSTERIORES = ["Medicación vigente", "Información y consentimientos", "Documentación de la obra social"];

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0095A8]/40 focus:border-[#0095A8]";

function Field({
  label,
  required,
  hint,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

/**
 * Alta de paciente en 3 pasos (DF-C3 §3). Reemplaza el formulario plano que
 * estaba al final de la página de Pacientes: nadie lo encontraba y no se
 * entendía cómo empezar. Todos los campos quedan montados en el DOM (solo se
 * ocultan los de otros pasos) para que se envíen juntos al final.
 */
export default function AdmissionWizard({ obrasSociales, profesionales = [], defaultOpen = false }: { obrasSociales: ObraSocial[]; profesionales?: Profesional[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(1);
  const [dniMsg, setDniMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [checking, startChecking] = useTransition();
  const [state, formAction, pending] = useActionState<AdmissionState, FormData>(createAdmissionAction, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function currentStepValid() {
    const box = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!box) return true;
    const fields = Array.from(box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select, textarea"));
    for (const f of fields) {
      if (!f.reportValidity()) return false;
    }
    return true;
  }

  function goNext() {
    if (!currentStepValid()) return;
    if (step === 1) {
      const dni = (formRef.current?.elements.namedItem("dni") as HTMLInputElement | null)?.value ?? "";
      startChecking(async () => {
        const r = await checkDniAction(dni);
        if (r.existe) {
          setDniMsg({ tone: "error", text: `Este DNI ya está cargado: ${r.nombre} (${r.estado}). No se puede dar de alta dos veces: buscalo en la lista de abajo.` });
          return;
        }
        setDniMsg(null);
        setStep(2);
      });
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  if (!open) {
    return (
      <section id="nuevo-paciente" className="scroll-mt-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap animate-fade-slide-up">
        <div>
          <h2 className="font-semibold text-slate-900">¿Ingresa un paciente nuevo?</h2>
          <p className="text-sm text-slate-600 mt-0.5">Te guiamos paso a paso. Lo primero que pedimos es el DNI, para avisarte si ya existe. El ingreso completo tiene 6 pasos: los 3 primeros acá y los otros 3 en la ficha del paciente.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white text-sm font-semibold px-5 py-3 shadow-sm hover:opacity-90 transition-opacity"
        >
          + Nuevo paciente
        </button>
      </section>
    );
  }

  return (
    <section id="nuevo-paciente" className="scroll-mt-6 bg-white border-2 border-[#0095A8]/40 rounded-2xl p-5 animate-fade-slide-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Nuevo paciente — paso {step} de 6</h2>
          <p className="text-sm text-slate-500">{STEPS[step - 1].title}: {STEPS[step - 1].hint}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
      </div>

      <ol className="flex items-center gap-2 mb-5" aria-label="Pasos del alta">
        {STEPS.map((s) => (
          <li key={s.n} className="flex items-center gap-2 flex-1">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${
                step > s.n ? "bg-emerald-500 text-white" : step === s.n ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > s.n ? "✓" : s.n}
            </span>
            <span className={`text-xs hidden sm:block ${step === s.n ? "text-slate-900 font-medium" : "text-slate-400"}`}>{s.title}</span>
            {s.n < 3 && <span className="flex-1 h-px bg-slate-200" />}
          </li>
        ))}
        <li className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 pl-2 border-l border-slate-200" title="Se completan en la ficha del paciente, después de admitirlo">
          4 · 5 · 6 en la ficha: {PASOS_POSTERIORES.join(", ").toLowerCase()}
        </li>
      </ol>

      <form
        ref={formRef}
        // Se envía con onSubmit (no con action=) para que React NO borre los campos
        // si el servidor devuelve un error: el usuario no pierde lo que escribió.
        onSubmit={(e) => {
          e.preventDefault();
          if (!formRef.current) return;
          const fd = new FormData(formRef.current);
          startSubmit(() => formAction(fd));
        }}
        onKeyDown={(e) => {
          // Enter en un paso intermedio = "Siguiente" (no enviar un formulario incompleto).
          if (e.key === "Enter" && step < 3 && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            goNext();
          }
        }}
        className="space-y-4"
      >
        <div data-step="1" className={step === 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "hidden"}>
          <Field label="DNI" required hint="Solo números, sin puntos. Identifica al paciente en todo el sistema.">
            <input name="dni" required inputMode="numeric" autoComplete="off" pattern="[0-9.\s]{6,12}" placeholder="Ej. 30998221" title="Entre 6 y 9 dígitos" className={inputCls} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input name="fecha_nacimiento" type="date" className={inputCls} />
          </Field>
          <Field label="Nombre y apellido" required className="sm:col-span-2">
            <input name="nombre_completo" required autoComplete="off" placeholder="Ej. María Fernanda Ríos" className={inputCls} />
          </Field>
          {dniMsg && (
            <p className={`sm:col-span-2 text-sm rounded-lg px-3 py-2 border ${dniMsg.tone === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              {dniMsg.text}
            </p>
          )}
          <Field label="Domicilio del paciente" required className="sm:col-span-2" hint="Es el domicilio donde se agendan las visitas.">
            <input name="domicilio" required autoComplete="off" placeholder="Calle, número, localidad" className={inputCls} />
          </Field>
          <Field label="Teléfono del paciente">
            <input name="telefono_contacto" type="tel" autoComplete="off" placeholder="Ej. 264 555 0123" className={inputCls} />
          </Field>
          <span className="hidden sm:block" />
          <Field label="Familiar responsable — nombre">
            <input name="contacto_familiar_nombre" autoComplete="off" placeholder="Quién se hace cargo" className={inputCls} />
          </Field>
          <Field label="Familiar responsable — teléfono">
            <input name="contacto_familiar_telefono" type="tel" autoComplete="off" placeholder="Ej. 264 555 0456" className={inputCls} />
          </Field>
        </div>

        <div data-step="2" className={step === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "hidden"}>
          <Field label="Obra social">
            <select name="obra_social_id" defaultValue="" className={inputCls}>
              <option value="">Sin obra social / particular</option>
              {obrasSociales.map((os) => (
                <option key={os.id} value={os.id}>{os.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="N° de afiliado">
            <input name="numero_afiliado" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="Médico derivante">
            <input name="medico_derivante" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="Fecha de ingreso al servicio" hint="Por defecto, hoy.">
            <input name="fecha_ingreso" type="date" defaultValue={hoyAR()} className={inputCls} />
          </Field>
        </div>

        <div data-step="3" className={step === 3 ? "space-y-3" : "hidden"}>
          <Field label="Diagnóstico principal">
            <input name="diagnostico_principal" autoComplete="off" placeholder="Motivo de la internación domiciliaria" className={inputCls} />
          </Field>
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Plan de tratamiento y equipo asistencial</p>
            <p className="text-[11px] text-slate-400 mb-2">Para cada disciplina que corresponda, indicá cuántas visitas necesita y qué profesional la atiende. Las que dejes vacías quedan fuera del plan; se pueden completar después en la ficha.</p>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {DISCIPLINAS_PLAN.map((d) => (
                <div key={d} className="p-3 grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                  <span className="col-span-2 sm:col-span-2 text-sm font-medium text-slate-800 self-center">{SPECIALTY_LABELS[d]}</span>
                  <label className="col-span-2 sm:col-span-4 block text-[11px] text-slate-500">Profesional
                    <select name={`equipo__${d}`} defaultValue="" className={`${inputCls} mt-0.5 py-2`}>
                      <option value="">Sin asignar</option>
                      {profesionales.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </label>
                  <label className="block text-[11px] text-slate-500 sm:col-span-2">Visitas
                    <input name={`plan__${d}__cantidad`} type="number" min={1} max={50} placeholder="—" className={`${inputCls} mt-0.5 py-2`} />
                  </label>
                  <label className="block text-[11px] text-slate-500 sm:col-span-2">Cada
                    <select name={`plan__${d}__unidad`} defaultValue="semana" className={`${inputCls} mt-0.5 py-2`}>
                      <option value="semana">semana</option>
                      <option value="dia">día</option>
                    </select>
                  </label>
                  <details className="col-span-2 sm:col-span-2 text-[11px] text-slate-500">
                    <summary className="cursor-pointer select-none">Días</summary>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                      {DIAS_CORTOS.map((dc, i) => (
                        <label key={dc} className="flex items-center gap-1"><input type="checkbox" name={`plan__${d}__dias`} value={i + 1} className="rounded border-slate-300" />{dc}</label>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Al admitir, el paciente queda en «Admitido, pendiente de llegada» y te llevamos a su ficha para completar los pasos 4 a 6: medicación, información y consentimientos, y documentación de la obra social.
          </p>
        </div>

        {state.error && (
          <p role="alert" className="text-sm rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="rounded-xl border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Atrás
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={checking}
              className="rounded-xl bg-slate-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {checking ? "Revisando DNI…" : "Siguiente →"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white text-sm font-semibold px-5 py-2.5 shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Admitiendo…" : "Admitir paciente"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
