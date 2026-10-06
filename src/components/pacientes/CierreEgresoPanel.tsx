"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import ActionDisclosure from "@/components/ActionDisclosure";
import ConfirmButton from "@/components/ConfirmButton";
import { confirmarEgresoAction, type CierreState } from "@/app/(dashboard)/pacientes/actions";
import { MOTIVO_EGRESO_LABELS, MOTIVOS_EGRESO_OPCIONES, MOTIVO_ALTA_VOLUNTARIA, MOTIVO_NO_SE_INICIA } from "@/lib/egreso";

type Equipo = { asset_id: string | null; descripcion: string | null; numero_serie: string | null };

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm";

/**
 * Cierre guiado de la internación (DF-C3 §11.1), en tres secciones: (1) motivo y fecha/hora del hecho,
 * (2) equipos que hay que retirar del domicilio y (3) confirmación. Lo usa Administración desde
 * «Pacientes» y desde «Autorizaciones de stock» (donde llegan los egresos informados).
 */
export default function CierreEgresoPanel({
  patientId,
  motivoInformado,
  hechoDefault,
  informadoPor,
  equipos,
  label = "Confirmar baja…",
  tone = "alert",
  pendienteLlegada = false,
}: {
  patientId: string;
  /** Motivo ya informado por un profesional o Coordinación (valor del enum), si lo hay. */
  motivoInformado: string;
  /** «AAAA-MM-DDTHH:mm» en hora de San Juan: el hecho informado o, si no hay, el momento actual. */
  hechoDefault: string;
  informadoPor: string | null;
  equipos: Equipo[];
  label?: string;
  tone?: "alert" | "subtle" | "default";
  /** Paciente admitido que todavía no llegó: se ofrece «No se inicia ID» (H5). */
  pendienteLlegada?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CierreState, FormData>(confirmarEgresoAction, { error: null });
  const [, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const opciones: string[] = pendienteLlegada ? [MOTIVO_NO_SE_INICIA, "internacion_otro"] : [...MOTIVOS_EGRESO_OPCIONES];
  const [motivoSel, setMotivoSel] = useState(motivoInformado || (pendienteLlegada ? MOTIVO_NO_SE_INICIA : ""));
  if (motivoInformado && !opciones.includes(motivoInformado)) opciones.push(motivoInformado);

  return (
    <ActionDisclosure label={label} tone={tone} className="w-full">
      <form
        ref={formRef}
        // Se envía con onSubmit para que React no borre lo escrito si el servidor devuelve un error.
        onSubmit={(e) => {
          e.preventDefault();
          if (!formRef.current) return;
          const fd = new FormData(formRef.current);
          startSubmit(() => formAction(fd));
        }}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="patient_id" value={patientId} />

        <section>
          <h3 className="text-sm font-semibold text-slate-900"><span className="text-slate-400">1.</span> Motivo y fecha del egreso</h3>
          {informadoPor && <p className="text-xs text-slate-500 mt-0.5">Lo informó {informadoPor}. Revisalo antes de confirmar.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <label className="block text-xs text-slate-600">Motivo
              <select name="motivo" required value={motivoSel} onChange={(e) => setMotivoSel(e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">Elegí el motivo…</option>
                {opciones.map((m) => <option key={m} value={m}>{MOTIVO_EGRESO_LABELS[m] ?? m}</option>)}
              </select>
            </label>
            <label className="block text-xs text-slate-600">Fecha y hora en que ocurrió
              <input name="hecho_at" type="datetime-local" required defaultValue={hechoDefault} className={`${inputCls} mt-1`} />
            </label>
          </div>
          {motivoSel === MOTIVO_ALTA_VOLUNTARIA && (
            <label className="block text-xs text-slate-600 mt-3">Familiar que firmó la solicitud de alta voluntaria
              <input name="solicitud_firmante" required placeholder="Nombre y apellido de quien firma" className={`${inputCls} mt-1`} />
              <span className="block text-[11px] text-slate-400 mt-1">La solicitud de alta se imprime y la firma el familiar; acá queda registrado quién la firmó y cuándo.</span>
            </label>
          )}
          {motivoSel === MOTIVO_NO_SE_INICIA && (
            <p className="text-xs text-slate-500 mt-2">El paciente fue admitido pero nunca llegó al domicilio: la internación se cierra sin iniciarse.</p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900"><span className="text-slate-400">2.</span> Equipos para retirar del domicilio</h3>
          {equipos.length === 0 ? (
            <p className="text-sm text-slate-500 mt-1">No hay equipos asignados en el domicilio.</p>
          ) : (
            <>
              <ul className="mt-1 text-sm text-slate-700 space-y-1">
                {equipos.map((e) => (
                  <li key={e.asset_id ?? e.numero_serie} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {e.descripcion ?? "Equipo"} <span className="text-xs text-slate-400">· serie {e.numero_serie ?? "—"}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-1">Al confirmar, Depósito y Transporte reciben la alerta con esta lista para coordinar el retiro.</p>
            </>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900"><span className="text-slate-400">3.</span> Confirmar</h3>
          <p className="text-xs text-slate-500 mt-0.5">La baja es definitiva: el paciente deja de figurar como activo y queda en el historial de internaciones. Si más adelante vuelve, se abre una nueva internación sobre el mismo legajo.</p>
          {state.error && <p role="alert" className="mt-2 text-sm rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{state.error}</p>}
          <div className="mt-2">
            <ConfirmButton
              className="rounded-lg bg-red-600 text-white text-sm font-medium px-4 py-2 hover:bg-red-700 transition-colors disabled:opacity-60"
              confirmLabel="¿Baja definitiva? Tocá de nuevo"
            >
              {pending ? "Confirmando…" : "Confirmar baja definitiva"}
            </ConfirmButton>
          </div>
        </section>
      </form>
    </ActionDisclosure>
  );
}
