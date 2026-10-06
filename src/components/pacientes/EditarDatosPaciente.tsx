"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import ActionDisclosure from "@/components/ActionDisclosure";
import { updatePatientDataAction, type EditarDatosState } from "@/app/(dashboard)/paciente/[id]/actions";
import { TIPOS_INTERNACION, TIPOS_POR_UNIDAD, UNIDADES_TRABAJO } from "@/lib/paciente";
import { PARTICULAR } from "@/lib/legajo";

export type DatosEditables = {
  id: string;
  dni: string;
  apellido: string;
  nombre: string;
  fecha_nacimiento: string;
  sexo: string;
  ocupacion: string;
  localidad: string;
  domicilio: string;
  telefono_contacto: string;
  domicilio_actual: string;
  telefono_actual: string;
  contacto_familiar_nombre: string;
  contacto_familiar_telefono: string;
  email_responsable: string;
  diagnostico_principal: string;
  obra_social_id: string;
  es_particular: boolean;
  numero_afiliado: string;
  tiene_coseguro: boolean;
  coseguro_detalle: string;
  medico_derivante: string;
  medico_matricula: string;
  institucion_derivante: string;
  unidad_trabajo: string;
  tipo_internacion: string;
  tiene_emergencias: boolean;
  emergencias_nombre: string;
  emergencias_telefono: string;
  en_tratamiento_atb: boolean;
  requiere_curaciones: boolean;
  fecha_ingreso: string;
  aclaraciones: string;
  extras: { nombre: string; parentesco: string; telefono: string; email: string }[];
};

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm";

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs text-slate-600 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Edición de los datos del paciente (H2): corrige errores de carga, cambios de domicilio o de persona responsable. */
export default function EditarDatosPaciente({ d, obrasSociales }: { d: DatosEditables; obrasSociales: { id: string; nombre: string }[] }) {
  const [state, formAction, pending] = useActionState<EditarDatosState, FormData>(updatePatientDataAction, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [unidad, setUnidad] = useState(d.unidad_trabajo);
  const [tipo, setTipo] = useState(d.tipo_internacion);
  const [coseguro, setCoseguro] = useState(d.tiene_coseguro);
  const [emerg, setEmerg] = useState(d.tiene_emergencias);
  const [osSel, setOsSel] = useState(d.es_particular ? PARTICULAR : d.obra_social_id);
  const [extras, setExtras] = useState(Math.max(d.extras.length, 0));
  const inicial = (n: number, k: keyof DatosEditables["extras"][number]) => d.extras[n - 1]?.[k] ?? "";

  return (
    <ActionDisclosure label="Editar los datos" tone="default" className="w-full">
      <form
        ref={formRef}
        // Se envía con onSubmit para que React no borre lo escrito si el servidor devuelve un error.
        onSubmit={(e) => {
          e.preventDefault();
          if (!formRef.current) return;
          const fd = new FormData(formRef.current);
          startSubmit(() => formAction(fd));
        }}
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      >
        <input type="hidden" name="patient_id" value={d.id} />
        <p className="text-xs text-slate-500">Cada cambio queda registrado en la auditoría con tu usuario. Si cambiás el DNI, revisá que el número sea el correcto: identifica al paciente en todo el sistema.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <F label="DNI"><input name="dni" required defaultValue={d.dni} inputMode="numeric" className={inputCls} /></F>
          <F label="Apellido"><input name="apellido" required defaultValue={d.apellido} className={inputCls} /></F>
          <F label="Nombre"><input name="nombre" required defaultValue={d.nombre} className={inputCls} /></F>
          <F label="Fecha de nacimiento"><input name="fecha_nacimiento" type="date" required defaultValue={d.fecha_nacimiento} className={inputCls} /></F>
          <F label="Sexo">
            <select name="sexo" required defaultValue={d.sexo} className={inputCls}>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro / no binario</option>
            </select>
          </F>
          <F label="Ocupación"><input name="ocupacion" defaultValue={d.ocupacion} className={inputCls} /></F>
          <F label="Localidad"><input name="localidad" required defaultValue={d.localidad} className={inputCls} /></F>
          <F label="Domicilio" className="sm:col-span-2"><input name="domicilio" required defaultValue={d.domicilio} className={inputCls} /></F>
          <F label="Teléfono del paciente"><input name="telefono_contacto" type="tel" defaultValue={d.telefono_contacto} className={inputCls} /></F>
          <F label="Domicilio actual (si vive en otro lugar)" className="sm:col-span-2"><input name="domicilio_actual" defaultValue={d.domicilio_actual} className={inputCls} /></F>
          <F label="Teléfono en el domicilio actual"><input name="telefono_actual" type="tel" defaultValue={d.telefono_actual} className={inputCls} /></F>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <F label="Persona responsable"><input name="contacto_familiar_nombre" required defaultValue={d.contacto_familiar_nombre} className={inputCls} /></F>
          <F label="Teléfono de la persona responsable"><input name="contacto_familiar_telefono" type="tel" required defaultValue={d.contacto_familiar_telefono} className={inputCls} /></F>
          <F label="Mail de la persona responsable"><input name="email_responsable" type="email" defaultValue={d.email_responsable} className={inputCls} /></F>
        </div>
        <div className="space-y-2">
          {Array.from({ length: extras }, (_, i) => i + 1).map((n) => (
            <div key={n} className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-xl border border-slate-200 p-2.5">
              <input name={`contacto_extra_${n}_nombre`} defaultValue={inicial(n, "nombre")} placeholder="Otro familiar de contacto" className={inputCls} />
              <input name={`contacto_extra_${n}_parentesco`} defaultValue={inicial(n, "parentesco")} placeholder="Parentesco" className={inputCls} />
              <input name={`contacto_extra_${n}_telefono`} type="tel" defaultValue={inicial(n, "telefono")} placeholder="Teléfono" className={inputCls} />
              <input name={`contacto_extra_${n}_email`} type="email" defaultValue={inicial(n, "email")} placeholder="Mail" className={inputCls} />
            </div>
          ))}
          {extras < 4 && (
            <button type="button" onClick={() => setExtras((x) => x + 1)} className="text-xs font-medium text-[var(--brand-teal)] underline underline-offset-2">
              + Agregar otro familiar de contacto
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <F label="Obra social">
            <select name="obra_social_id" value={osSel} onChange={(e) => setOsSel(e.target.value)} className={inputCls}>
              <option value="">Sin obra social</option>
              <option value={PARTICULAR}>Particular</option>
              {obrasSociales.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </F>
          <F label="N° de afiliado"><input name="numero_afiliado" defaultValue={d.numero_afiliado} className={inputCls} /></F>
          <label className="flex items-center gap-2 text-sm text-slate-700 self-end pb-2">
            <input type="checkbox" name="tiene_coseguro" checked={coseguro} onChange={(e) => setCoseguro(e.target.checked)} className="rounded border-slate-300" /> Paga coseguro
          </label>
          {coseguro && <F label="Detalle del coseguro" className="sm:col-span-3"><input name="coseguro_detalle" defaultValue={d.coseguro_detalle} className={inputCls} /></F>}
          <F label="Institución derivante"><input name="institucion_derivante" defaultValue={d.institucion_derivante} className={inputCls} /></F>
          <F label="Médico derivante"><input name="medico_derivante" defaultValue={d.medico_derivante} className={inputCls} /></F>
          <F label="Matrícula del médico derivante"><input name="medico_matricula" defaultValue={d.medico_matricula} className={inputCls} /></F>
          <F label="Unidad de trabajo">
            <select name="unidad_trabajo" required value={unidad} onChange={(e) => { setUnidad(e.target.value); setTipo(""); }} className={inputCls}>
              <option value="" disabled>Elegí la unidad</option>
              {Object.entries(UNIDADES_TRABAJO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          <F label="Tipo de internación">
            <select name="tipo_internacion" required value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!unidad} className={inputCls}>
              <option value="" disabled>Elegí el tipo</option>
              {(TIPOS_POR_UNIDAD[unidad] ?? []).map((k) => <option key={k} value={k}>{TIPOS_INTERNACION[k]}</option>)}
            </select>
          </F>
          <F label="Fecha de ingreso al servicio"><input name="fecha_ingreso" type="date" required defaultValue={d.fecha_ingreso} className={inputCls} /></F>
          <F label="Diagnóstico principal" className="sm:col-span-3"><input name="diagnostico_principal" required defaultValue={d.diagnostico_principal} className={inputCls} /></F>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="tiene_emergencias" checked={emerg} onChange={(e) => setEmerg(e.target.checked)} className="rounded border-slate-300" /> Tiene servicio de emergencias
          </label>
          {emerg && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input name="emergencias_nombre" required defaultValue={d.emergencias_nombre} placeholder="Cuál" className={inputCls} />
              <input name="emergencias_telefono" required type="tel" defaultValue={d.emergencias_telefono} placeholder="Teléfono" className={inputCls} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="en_tratamiento_atb" defaultChecked={d.en_tratamiento_atb} className="rounded border-slate-300" /> En tratamiento antibiótico</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="requiere_curaciones" defaultChecked={d.requiere_curaciones} className="rounded border-slate-300" /> Requiere curaciones</label>
        </div>
        <F label="Aclaraciones importantes (solo para el personal)"><textarea name="aclaraciones" rows={3} defaultValue={d.aclaraciones} className={inputCls} /></F>

        {state.error && <p role="alert" className="text-sm rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
        {state.ok && !state.error && <p role="status" className="text-sm rounded-lg px-3 py-2 border bg-emerald-50 border-emerald-200 text-emerald-800">Cambios guardados.</p>}
        <button disabled={pending} className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </ActionDisclosure>
  );
}
