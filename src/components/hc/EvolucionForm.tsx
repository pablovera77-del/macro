"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createEvolutionAction } from "@/app/(dashboard)/evoluciones/actions";
import { campoKey, NOVA5_DIMENSIONES, riesgoNova5, RIESGO_TONE, type Campo, type MedicacionItem } from "@/lib/hc";
import StatusBadge from "@/components/StatusBadge";
import FirmaCanvas from "@/components/hc/FirmaCanvas";
import DictadoButton from "@/components/hc/DictadoButton";

const inputCls = "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm w-full";

function Etiqueta({ c }: { c: Campo }) {
  return (
    <label className="text-xs font-medium text-slate-700 mb-1 block">
      {c.label}
      {c.obligatorio && <span className="text-red-500"> *</span>}
    </label>
  );
}

function TextoLargo({ name, required, rows = 3 }: { name: string; required?: boolean; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <textarea ref={ref} name={name} required={required} rows={rows} className={inputCls} />
      <div className="mt-1 flex justify-end">
        <DictadoButton target={ref} />
      </div>
    </div>
  );
}

function CampoInput({ c }: { c: Campo }) {
  const name = `campo__${campoKey(c)}`;
  const req = c.obligatorio;
  switch (c.tipo) {
    case "Texto largo":
      return <TextoLargo name={name} required={req} />;
    case "Número":
    case "Año":
      return <input name={name} type="number" inputMode="decimal" step={c.paso ?? "any"} required={req} className={inputCls} />;
    case "Fecha y hora":
      return <input name={name} type="datetime-local" required={req} className={inputCls} />;
    case "Fecha":
    case "Día":
      return <input name={name} type="date" required={req} className={inputCls} />;
    case "Hora":
      return <input name={name} type="time" required={req} className={inputCls} />;
    case "Sí/No":
      return (
        <div className="flex gap-2" role="radiogroup" aria-label={c.label}>
          {["Sí", "No"].map((op) => (
            <label
              key={op}
              className="flex-1 sm:flex-none sm:min-w-20 text-center cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 has-[:checked]:bg-slate-900 has-[:checked]:text-white has-[:checked]:border-slate-900"
            >
              <input type="radio" name={name} value={op} required={req} className="sr-only" />
              {op}
            </label>
          ))}
        </div>
      );
    case "Selección":
      return (
        <select name={name} required={req} defaultValue="" className={inputCls}>
          <option value="">Elegí una opción…</option>
          {(c.opciones ?? []).map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      );
    default:
      return <input name={name} type="text" required={req} className={inputCls} />;
  }
}

const MED_VACIA: MedicacionItem = { cantidad: "", droga: "", nombre_comercial: "", dosis: "", frecuencia: "" };

/**
 * Formulario de evolución de una visita realizada: campos de la plantilla de la disciplina,
 * bloques propios de enfermería (escala Nova 5) y medicina (medicación y alerta), y las dos
 * firmas. Si el envío falla o no hay conexión, lo cargado queda en pantalla y se guarda un
 * borrador en este dispositivo (sin firmas) para no perder el trabajo.
 */
export default function EvolucionForm({
  visitId,
  patientId,
  especialidad,
  campos,
  mostrarUpp,
  profesionalNombre,
  matriculaInicial,
}: {
  visitId: string;
  patientId: string;
  especialidad: string;
  campos: Campo[];
  /** Enfermería y paciente sin valoración previa de úlceras por presión. */
  mostrarUpp: boolean;
  profesionalNombre: string;
  matriculaInicial: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [meds, setMeds] = useState<MedicacionItem[]>([]);
  const [alerta, setAlerta] = useState(false);
  const [nova, setNova] = useState<Record<string, string>>({});
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const draftKey = `hc-borrador-${visitId}`;

  const secciones: { titulo: string | null; campos: Campo[] }[] = [];
  for (const c of campos) {
    const titulo = c.seccion ?? null;
    let s = secciones.find((x) => x.titulo === titulo);
    if (!s) {
      s = { titulo, campos: [] };
      secciones.push(s);
    }
    s.campos.push(c);
  }

  // Borrador local: solo comodidad. Se restaura una vez, se guarda al escribir y se borra al enviar bien.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      const form = formRef.current;
      if (!raw || !form) return;
      const d = JSON.parse(raw) as { campos: Record<string, string>; meds?: MedicacionItem[]; alerta?: boolean; nova?: Record<string, string> };
      let restaurado = false;
      for (const [name, value] of Object.entries(d.campos ?? {})) {
        const el = form.elements.namedItem(name);
        if (!el) continue;
        if (el instanceof RadioNodeList) {
          el.value = value;
        } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          el.value = value;
        }
        restaurado = true;
      }
      /* eslint-disable react-hooks/set-state-in-effect */
      if (d.meds?.length) setMeds(d.meds);
      if (d.alerta) setAlerta(true);
      if (d.nova) setNova(d.nova);
      if (restaurado) setBorradorRestaurado(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* sin borrador */
    }
  }, [draftKey]);

  function guardarBorrador() {
    try {
      const form = formRef.current;
      if (!form) return;
      const campos: Record<string, string> = {};
      for (const [k, v] of new FormData(form).entries()) {
        if (typeof v === "string" && (k.startsWith("campo__") || k === "alerta_motivo" || k === "conformidad_nombre" || k === "matricula") && v !== "") campos[k] = v;
      }
      if (Object.keys(campos).length === 0 && meds.length === 0 && !alerta && Object.keys(nova).length === 0) return;
      localStorage.setItem(draftKey, JSON.stringify({ campos, meds, alerta, nova }));
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  // Los renglones de medicación, la alerta y la escala son estado de React: se guardan cuando cambian.
  useEffect(() => {
    guardarBorrador();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds, alerta, nova]);

  function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    setError(null);
    const fd = new FormData(form);
    if (!fd.get("firma_profesional_img")) return setError("Falta tu firma. Dibujala en el recuadro «Firma del profesional».");
    if (!fd.get("conformidad_img")) return setError("Falta la firma de conformidad del paciente o familiar. Pedile que la dibuje en el recuadro.");
    fd.set("medicacion", JSON.stringify(meds));
    guardarBorrador();
    startTransition(async () => {
      try {
        const r = await createEvolutionAction(fd);
        if (r?.error) {
          setError(r.error);
          return;
        }
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* nada */
        }
      } catch {
        setError("No se pudo enviar. Si estás sin señal, no pasa nada: lo que cargaste quedó guardado en este dispositivo (sin las firmas). Cuando tengas conexión, volvé a tocar «Guardar y firmar».");
      }
    });
  }

  const totalNova = NOVA5_DIMENSIONES.reduce((a, d) => a + (Number(nova[d.key]) || 0), 0);
  const novaCompleta = NOVA5_DIMENSIONES.every((d) => nova[d.key] !== undefined && nova[d.key] !== "");
  const riesgo = novaCompleta ? riesgoNova5(totalNova) : null;

  function setMed(i: number, k: keyof MedicacionItem, v: string) {
    setMeds((prev) => prev.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  }

  return (
    <form ref={formRef} onSubmit={enviar} onChange={guardarBorrador} className="mt-4 space-y-5">
      <input type="hidden" name="visit_id" value={visitId} />
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="especialidad" value={especialidad} />

      {borradorRestaurado && (
        <p className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
          Recuperamos lo que habías empezado a cargar en este dispositivo. Revisalo antes de guardar.
        </p>
      )}

      {secciones.length === 0 && (
        <p className="text-sm text-slate-500">Esta disciplina todavía no tiene un formulario cargado: solo se firma la visita.</p>
      )}
      {secciones.map((s, i) => (
        <fieldset key={`${s.titulo ?? "gral"}-${i}`} className="space-y-3 min-w-0">
          {s.titulo && <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{s.titulo}</legend>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {s.campos.map((c) => {
              const ancho = c.tipo === "Texto largo" || c.tipo === "Texto" || c.tipo === "Selección" ? "col-span-2 sm:col-span-4" : c.tipo === "Sí/No" ? "col-span-2 sm:col-span-2" : "col-span-1 sm:col-span-1";
              return (
                <div key={campoKey(c)} className={ancho}>
                  <Etiqueta c={c} />
                  <CampoInput c={c} />
                  {c.ayuda && <p className="text-[11px] text-slate-400 mt-1">{c.ayuda}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      {especialidad === "medicina" && (
        <>
          <fieldset className="space-y-3 min-w-0">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Medicación indicada</legend>
            {meds.length === 0 && <p className="text-xs text-slate-400">Si indicaste o cambiaste medicación, agregala acá, un renglón por medicamento.</p>}
            {meds.map((m, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="col-span-1">
                    <label className="text-[11px] text-slate-500 block mb-0.5">Cantidad</label>
                    <input value={m.cantidad} onChange={(e) => setMed(i, "cantidad", e.target.value)} placeholder="Ej.: 2 cajas" className={inputCls} />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[11px] text-slate-500 block mb-0.5">Droga *</label>
                    <input value={m.droga} onChange={(e) => setMed(i, "droga", e.target.value)} placeholder="Ej.: enoxaparina" className={inputCls} />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[11px] text-slate-500 block mb-0.5">Nombre comercial</label>
                    <input value={m.nombre_comercial} onChange={(e) => setMed(i, "nombre_comercial", e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-[11px] text-slate-500 block mb-0.5">Dosis</label>
                    <input value={m.dosis} onChange={(e) => setMed(i, "dosis", e.target.value)} placeholder="Ej.: 40 mg" className={inputCls} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-[11px] text-slate-500 block mb-0.5">Frecuencia</label>
                    <input value={m.frecuencia} onChange={(e) => setMed(i, "frecuencia", e.target.value)} placeholder="Ej.: cada 12 h" className={inputCls} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <button type="button" onClick={() => setMeds((prev) => prev.filter((_, j) => j !== i))} className="w-full rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-600 px-3 py-2 hover:bg-slate-100">
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setMeds((prev) => [...prev, { ...MED_VACIA }])} className="rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 px-3 py-2 hover:bg-slate-50">
              + Agregar medicamento
            </button>
          </fieldset>

          <fieldset className={`rounded-xl border p-3 space-y-2 min-w-0 ${alerta ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
            <label className="flex items-start gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" name="alerta_cambio" checked={alerta} onChange={(e) => setAlerta(e.target.checked)} className="mt-0.5 rounded border-slate-300" />
              <span>
                Hubo un cambio relevante en la medicación o la indicación
                <span className="block text-[11px] font-normal text-slate-500">Al guardar, avisamos al equipo del paciente, a Coordinación y a Administración.</span>
              </span>
            </label>
            {alerta && (
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">
                  ¿Qué cambió? <span className="text-red-500">*</span>
                </label>
                <textarea name="alerta_motivo" required rows={2} className={inputCls} placeholder="Ej.: se suspende el anticoagulante por sangrado" />
              </div>
            )}
          </fieldset>
        </>
      )}

      {especialidad === "enfermeria" && mostrarUpp && (
        <fieldset className="bg-slate-50 rounded-xl p-3 min-w-0">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Riesgo de úlceras por presión (Nova 5) · primera valoración</legend>
          <p className="text-[11px] text-slate-500 mb-3">Se completa una sola vez, al ingreso. Si hoy no corresponde, dejá todo en «No aplica».</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {NOVA5_DIMENSIONES.map((d) => (
              <div key={d.key}>
                <label className="text-xs font-medium text-slate-700 mb-1 block">{d.label}</label>
                <select
                  name={`nova5__${d.key}`}
                  value={nova[d.key] ?? ""}
                  onChange={(e) => setNova((p) => ({ ...p, [d.key]: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">No aplica</option>
                  {d.niveles.map((n, i) => (
                    <option key={n} value={i}>
                      {n} ({i})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-slate-600">
            <span>Suma: <strong className="text-slate-900">{novaCompleta ? totalNova : "—"}</strong></span>
            {riesgo ? <StatusBadge tone={RIESGO_TONE[riesgo]} label={`Riesgo ${riesgo}`} /> : novaCompleta ? <StatusBadge tone="gris" label="Sin riesgo" /> : null}
            <span className="text-slate-400">1–4 bajo · 5–8 medio · 9–15 alto</span>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" name="nova5__movilizacion" className="mt-0.5 rounded border-slate-300" />
            <span>Le indiqué al familiar las pautas de movilización y las entendió (firma de conformidad abajo).</span>
          </label>
        </fieldset>
      )}

      <fieldset className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 border-t border-slate-100 pt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 px-0">Firmas</legend>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Profesional</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700">{profesionalNombre}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">
                Matrícula <span className="text-red-500">*</span>
              </label>
              <input name="matricula" required defaultValue={matriculaInicial ?? ""} placeholder="Ej.: MP 1234" className={inputCls} />
            </div>
          </div>
          <FirmaCanvas name="firma_profesional" titulo="Firma del profesional" />
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">
              Nombre de quien firma por el paciente o la familia <span className="text-red-500">*</span>
            </label>
            <input name="conformidad_nombre" required placeholder="Nombre y apellido" className={inputCls} />
          </div>
          <FirmaCanvas name="conformidad" titulo="Conformidad del paciente o familiar" ayuda="Pasale el celular a quien firma para que dibuje la firma." />
        </div>
      </fieldset>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          disabled={pending}
          className="w-full sm:w-auto rounded-xl bg-slate-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-slate-800 transition-colors disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar y firmar evolución"}
        </button>
      </div>
    </form>
  );
}
