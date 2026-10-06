"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { createAdmissionAction, checkDniAction, type AdmissionState, type DniCheck, type PacienteSimilar } from "@/app/(dashboard)/internacion/actions";
import { DISCIPLINAS_PLAN, DIAS_CORTOS, hoyAR } from "@/lib/plan";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { edadEnAnios, fechaCorta, TIPOS_INTERNACION, TIPOS_POR_UNIDAD, UNIDADES_TRABAJO, SIN_EMERGENCIAS } from "@/lib/paciente";
import { PARTICULAR } from "@/lib/legajo";
import DniScanner from "@/components/DniScanner";
import type { DatosDni } from "@/lib/dni-pdf417";

type ObraSocial = { id: string; nombre: string };
type Profesional = { id: string; full_name: string };

const STEPS = [
  { n: 1, title: "Datos personales", hint: "DNI, nombre, domicilio y persona responsable" },
  { n: 2, title: "Cobertura y servicio", hint: "Obra social, derivación, unidad de trabajo y emergencias" },
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
  // Legajo encontrado por DNI (con su historial de internaciones) y modo «nueva internación».
  const [dniInfo, setDniInfo] = useState<DniCheck | null>(null);
  const [reingreso, setReingreso] = useState<{ id: string; nombre: string; nro: number | null } | null>(null);
  // Pacientes parecidos (aviso que no bloquea): se muestra una vez y el segundo «Siguiente» sigue igual.
  const [similares, setSimilares] = useState<PacienteSimilar[] | null>(null);
  const [ackKey, setAckKey] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [difiere, setDifiere] = useState(false);
  const [osSel, setOsSel] = useState("");
  const [unidad, setUnidad] = useState("");
  const [tipo, setTipo] = useState("");
  const [coseguro, setCoseguro] = useState(false);
  const [emerg, setEmerg] = useState(false);
  const [extras, setExtras] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [checking, startChecking] = useTransition();
  const [state, formAction, pending] = useActionState<AdmissionState, FormData>(createAdmissionAction, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const edad = edadEnAnios(nacimiento);

  function currentStepValid() {
    const box = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!box) return true;
    const fields = Array.from(box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select, textarea"));
    for (const f of fields) {
      if (!f.reportValidity()) return false;
    }
    return true;
  }

  function setField(name: string, value: string | null | undefined) {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (el && "value" in el) el.value = value ?? "";
  }

  // «Nueva internación para este paciente»: se reabre el legajo y se precargan sus datos para revisarlos.
  function iniciarReingreso() {
    const pac = dniInfo?.paciente;
    if (!pac) return;
    const d = pac.datos;
    setReingreso({ id: pac.id, nombre: pac.nombre_completo, nro: pac.nro_historia_clinica });
    // Pacientes cargados antes de separar apellido y nombre: todo el nombre queda en «Nombre» para corregirlo.
    setField("apellido", d.apellido ?? "");
    setField("nombre", d.apellido ? d.nombre : pac.nombre_completo);
    for (const k of ["email_responsable", "institucion_derivante", "fecha_nacimiento", "sexo", "ocupacion", "localidad", "domicilio", "telefono_contacto", "domicilio_actual", "telefono_actual", "contacto_familiar_nombre", "contacto_familiar_telefono", "obra_social_id", "numero_afiliado", "medico_derivante", "medico_matricula", "diagnostico_principal"]) {
      setField(k, d[k]);
    }
    setNacimiento(d.fecha_nacimiento ?? "");
    setOsSel(d.obra_social_id ?? "");
    setUnidad(d.unidad_trabajo ?? "");
    setTipo(d.tipo_internacion ?? "");
    setDifiere(!!(d.domicilio_actual || d.telefono_actual));
    setSimilares(null);
  }

  function cancelarReingreso() {
    setReingreso(null);
    setDniInfo(null);
  }

  function capturarUbicacion() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  function aplicarDni(d: DatosDni) {
    setField("dni", d.dni);
    setField("apellido", d.apellido);
    setField("nombre", d.nombre);
    setField("sexo", d.sexo);
    setField("fecha_nacimiento", d.fecha_nacimiento);
    setNacimiento(d.fecha_nacimiento);
    setDniInfo(null);
    setSimilares(null);
  }

  function goNext() {
    if (!currentStepValid()) return;
    if (step === 1) {
      const f = formRef.current;
      const val = (n: string) => (f?.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
      const dni = val("dni");
      const nombre = `${val("nombre")} ${val("apellido")}`.trim();
      const tel = val("telefono_contacto") || val("contacto_familiar_telefono");
      startChecking(async () => {
        // Nueva internación de un legajo existente: ya se sabe que el DNI existe, no se vuelve a buscar.
        if (reingreso) {
          setStep(2);
          return;
        }
        const r = await checkDniAction(dni, nombre, tel);
        if (r.existe && r.paciente) {
          setDniInfo(r);
          setSimilares(null);
          return;
        }
        setDniInfo(null);
        if (r.similares && r.similares.length > 0) {
          const key = `${nombre.trim().toLowerCase()}|${tel.replace(/\D/g, "")}`;
          if (ackKey !== key) {
            setSimilares(r.similares);
            setAckKey(key);
            return;
          }
        }
        setSimilares(null);
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
          <h2 className="font-semibold text-slate-900">{reingreso ? "Nueva internación" : "Nuevo paciente"} — paso {step} de 6</h2>
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
        <input type="hidden" name="reingreso_patient_id" value={reingreso?.id ?? ""} />
        <input type="hidden" name="lat" value={coords?.lat ?? ""} />
        <input type="hidden" name="lng" value={coords?.lng ?? ""} />

        {reingreso && (
          <div className={`rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-900 ${step === 1 ? "" : "hidden"}`}>
            <p>
              <strong>Nueva internación de {reingreso.nombre}</strong>
              {reingreso.nro ? ` · historia clínica N° ${reingreso.nro}` : ""}. Se reabre su legajo: revisá que los datos sigan vigentes y completá lo que falte.
            </p>
            <button type="button" onClick={cancelarReingreso} className="mt-1 text-xs font-medium underline underline-offset-2">Cancelar y buscar otro DNI</button>
          </div>
        )}

        <div data-step="1" className={step === 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "hidden"}>
          <Field label="DNI" required hint="Solo números, sin puntos. Identifica al paciente en todo el sistema.">
            <input
              name="dni"
              required
              inputMode="numeric"
              autoComplete="off"
              readOnly={!!reingreso}
              pattern="[0-9.\s]{6,12}"
              placeholder="Ej. 30998221"
              title="Entre 6 y 9 dígitos"
              onChange={() => { setDniInfo(null); setSimilares(null); }}
              className={`${inputCls} ${reingreso ? "bg-slate-100 text-slate-500" : ""}`}
            />
          </Field>
          <Field label="Fecha de nacimiento" required hint={edad !== null ? `Edad: ${edad} ${edad === 1 ? "año" : "años"}` : undefined}>
            <input name="fecha_nacimiento" type="date" required max={hoyAR()} value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Apellido" required>
            <input name="apellido" required autoComplete="off" placeholder="Ej. Ríos" className={inputCls} />
          </Field>
          <Field label="Nombre" required>
            <input name="nombre" required autoComplete="off" placeholder="Ej. María Fernanda" className={inputCls} />
          </Field>
          {!reingreso && <DniScanner onResult={aplicarDni} />}

          {dniInfo?.existe && dniInfo.paciente && !reingreso && (
            <div role="alert" className="sm:col-span-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-2">
              <p>
                <strong>Este DNI ya tiene legajo:</strong> {dniInfo.paciente.nombre_completo}
                {dniInfo.paciente.nro_historia_clinica ? ` · historia clínica N° ${dniInfo.paciente.nro_historia_clinica}` : ""} · {dniInfo.paciente.estado_label}.
              </p>
              {(dniInfo.internaciones ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-800">Internaciones anteriores</p>
                  <ul className="text-xs text-amber-900 mt-0.5 space-y-0.5">
                    {(dniInfo.internaciones ?? []).map((i) => (
                      <li key={i.numero}>
                        N° {i.numero}: ingresó el {fechaCorta(i.fecha_ingreso)}
                        {i.estado === "finalizada" ? ` · egresó el ${fechaCorta(i.fecha_egreso)}${i.motivo ? ` (${i.motivo})` : ""}` : " · en curso"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dniInfo.paciente.estado === "dado_de_baja" ? (
                <p className="text-xs">No hace falta cargarlo de nuevo: abrí una nueva internación sobre el mismo legajo y se conserva todo su historial.</p>
              ) : (
                <p className="text-xs">Este paciente todavía tiene una internación abierta, así que no se puede dar de alta otra vez. Abrí su legajo para seguir con su ingreso.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {dniInfo.paciente.estado === "dado_de_baja" && (
                  <button type="button" onClick={iniciarReingreso} className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800">
                    Nueva internación para este paciente
                  </button>
                )}
                <Link href={`/paciente/${dniInfo.paciente.id}`} className="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50">
                  Abrir legajo
                </Link>
              </div>
            </div>
          )}

          {similares && similares.length > 0 && (
            <div role="status" className="sm:col-span-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-1.5">
              <p><strong>Ya existe un paciente similar.</strong> Revisá que no sea la misma persona antes de seguir:</p>
              <ul className="space-y-1">
                {similares.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>{x.nombre_completo} · DNI {x.dni}{x.nro_historia_clinica ? ` · HC N° ${x.nro_historia_clinica}` : ""} · {x.estado_label}</span>
                    <span className="text-xs text-amber-700">({x.motivo === "telefono" ? "mismo teléfono" : "nombre parecido"})</span>
                    <Link href={`/paciente/${x.id}`} target="_blank" className="text-xs font-medium underline underline-offset-2">Abrir legajo ↗</Link>
                  </li>
                ))}
              </ul>
              <p className="text-xs">Si es otra persona, tocá «Es otra persona, continuar».</p>
            </div>
          )}

          <Field label="Sexo" required>
            <select name="sexo" required defaultValue="" className={inputCls}>
              <option value="" disabled>Elegí una opción</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro / no binario</option>
            </select>
          </Field>
          <Field label="Ocupación">
            <input name="ocupacion" autoComplete="off" placeholder="Ej. Jubilado, docente" className={inputCls} />
          </Field>
          <Field label="Localidad" required>
            <input name="localidad" required autoComplete="off" placeholder="Ej. Pocito" className={inputCls} />
          </Field>
          <Field label="Domicilio del paciente" required hint="Es el domicilio donde se agendan las visitas.">
            <input name="domicilio" required autoComplete="off" placeholder="Calle y número" className={inputCls} />
          </Field>
          <Field label="Teléfono del paciente">
            <input name="telefono_contacto" type="tel" autoComplete="off" placeholder="Ej. 264 555 0123" className={inputCls} />
          </Field>
          <div className="flex flex-col justify-end gap-1">
            <button type="button" onClick={capturarUbicacion} disabled={locating} className="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50 disabled:opacity-60 text-left">
              {locating ? "Buscando ubicación…" : coords ? "✓ Ubicación guardada (tocá para actualizar)" : "Capturar ubicación del domicilio"}
            </button>
            <span className="text-[11px] text-slate-400">Opcional. Hacelo solo si estás en el domicilio del paciente.</span>
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={difiere} onChange={(e) => setDifiere(e.target.checked)} className="rounded border-slate-300" />
            El paciente está viviendo en otro domicilio por ahora
          </label>
          <Field label="Domicilio actual" className={difiere ? "" : "hidden"} hint="Donde se encuentra hoy, si difiere del habitual.">
            <input name="domicilio_actual" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="Teléfono en el domicilio actual" className={difiere ? "" : "hidden"}>
            <input name="telefono_actual" type="tel" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="Persona responsable — nombre" required hint="Familiar o referente que se hace cargo.">
            <input name="contacto_familiar_nombre" required autoComplete="off" placeholder="Quién se hace cargo" className={inputCls} />
          </Field>
          <Field label="Persona responsable — teléfono" required hint="Con código de área. Se usa para avisarle por WhatsApp.">
            <input name="contacto_familiar_telefono" type="tel" required autoComplete="off" placeholder="Ej. 264 555 0456" className={inputCls} />
          </Field>
          <Field label="Persona responsable — mail" hint="Opcional. Sirve para avisos y para el acceso del familiar.">
            <input name="email_responsable" type="email" autoComplete="off" placeholder="nombre@correo.com" className={inputCls} />
          </Field>
          <div className="sm:col-span-2 space-y-2">
            {Array.from({ length: extras }, (_, i) => i + 1).map((n) => (
              <div key={n} className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-xl border border-slate-200 p-2.5">
                <input name={`contacto_extra_${n}_nombre`} placeholder="Otro familiar de contacto" className={inputCls} />
                <input name={`contacto_extra_${n}_parentesco`} placeholder="Parentesco" className={inputCls} />
                <input name={`contacto_extra_${n}_telefono`} type="tel" placeholder="Teléfono" className={inputCls} />
                <input name={`contacto_extra_${n}_email`} type="email" placeholder="Mail" className={inputCls} />
              </div>
            ))}
            {extras < 4 && (
              <button type="button" onClick={() => setExtras((x) => x + 1)} className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">
                + Agregar otro familiar de contacto
              </button>
            )}
          </div>
        </div>

        <div data-step="2" className={step === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "hidden"}>
          <Field label="Obra social">
            <select name="obra_social_id" value={osSel} onChange={(e) => setOsSel(e.target.value)} className={inputCls}>
              <option value="">Sin obra social</option>
              <option value={PARTICULAR}>Particular</option>
              {obrasSociales.map((os) => (
                <option key={os.id} value={os.id}>{os.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="N° de afiliado" required={!!osSel} hint={osSel ? undefined : "Se pide cuando el paciente tiene obra social."}>
            <input name="numero_afiliado" required={!!osSel} autoComplete="off" className={inputCls} />
          </Field>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="tiene_coseguro" checked={coseguro} onChange={(e) => setCoseguro(e.target.checked)} className="rounded border-slate-300" />
              El paciente paga coseguro
            </label>
            {coseguro && (
              <input name="coseguro_detalle" autoComplete="off" placeholder="Detalle del coseguro (ej. 20% por visita)" className={inputCls} />
            )}
          </div>
          <Field label="Institución derivante" hint="De dónde llega el paciente (ej. Sanatorio Argentino).">
            <input name="institucion_derivante" autoComplete="off" list="instituciones-derivantes" className={inputCls} />
            <datalist id="instituciones-derivantes">
              {["Sanatorio Argentino", "Hospital Rawson", "Hospital Marcial Quiroga", "Clínica Mayo", "Clínica Santa Clara", "Domicilio / consultorio"].map((i) => <option key={i} value={i} />)}
            </datalist>
          </Field>
          <Field label="Médico derivante">
            <input name="medico_derivante" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="Unidad de trabajo" required>
            <select name="unidad_trabajo" required value={unidad} onChange={(e) => { setUnidad(e.target.value); setTipo(""); }} className={inputCls}>
              <option value="" disabled>Elegí la unidad</option>
              {Object.entries(UNIDADES_TRABAJO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Tipo de internación" required hint={unidad ? undefined : "Primero elegí la unidad de trabajo."}>
            <select name="tipo_internacion" required value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!unidad} className={inputCls}>
              <option value="" disabled>Elegí el tipo</option>
              {(TIPOS_POR_UNIDAD[unidad] ?? []).map((k) => <option key={k} value={k}>{TIPOS_INTERNACION[k]}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 rounded-xl border border-slate-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="tiene_emergencias" checked={emerg} onChange={(e) => setEmerg(e.target.checked)} className="rounded border-slate-300" />
              Tiene servicio de emergencias contratado
            </label>
            {emerg ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input name="emergencias_nombre" required autoComplete="off" placeholder="Cuál (ej. Emergencias Cuyo)" className={inputCls} />
                <input name="emergencias_telefono" required type="tel" autoComplete="off" placeholder="Teléfono del servicio" className={inputCls} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin servicio de emergencias: la ficha va a mostrar «{SIN_EMERGENCIAS}».</p>
            )}
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="en_tratamiento_atb" className="rounded border-slate-300" /> En tratamiento antibiótico
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="requiere_curaciones" className="rounded border-slate-300" /> Requiere curaciones
            </label>
            <span className="text-[11px] text-slate-400 w-full">Sirven para filtrar el listado de pacientes.</span>
          </div>
          <Field label="Aclaraciones importantes" className="sm:col-span-2" hint="Solo las ve el personal de la empresa; el paciente y el familiar no. Por ejemplo: «va a diálisis martes y miércoles de 9 a 12».">
            <textarea name="aclaraciones" rows={3} className={inputCls} />
          </Field>
          <Field label="Matrícula del médico derivante">
            <input name="medico_matricula" autoComplete="off" placeholder="Ej. MP 1234" className={inputCls} />
          </Field>
          <Field label="Fecha de ingreso al servicio" required hint="El día en que arranca el servicio. No es el vencimiento de la autorización (se carga con las prácticas).">
            <input name="fecha_ingreso" type="date" defaultValue={hoyAR()} className={inputCls} />
          </Field>
        </div>

        <div data-step="3" className={step === 3 ? "space-y-3" : "hidden"}>
          <Field label="Diagnóstico principal" required>
            <input name="diagnostico_principal" required autoComplete="off" placeholder="Motivo de la internación domiciliaria" className={inputCls} />
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
              {checking ? "Revisando…" : similares && similares.length > 0 ? "Es otra persona, continuar →" : "Siguiente →"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white text-sm font-semibold px-5 py-2.5 shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Guardando…" : reingreso ? "Abrir nueva internación" : "Admitir paciente"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
