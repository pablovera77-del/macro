"use client";

import { useActionState } from "react";
import { createFamilyAccessAction, type FamilyAccessResult } from "@/app/(dashboard)/paciente/[id]/actions";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/San_Juan", day: "numeric", month: "long", year: "numeric" });

/**
 * Genera la tarjeta de acceso de la familia (QR + PIN). El PIN se ve una sola vez,
 * por eso la tarjeta se puede imprimir desde acá.
 */
export default function FamilyAccessPanel({ patientId, patientName, hayActivo }: { patientId: string; patientName: string; hayActivo: boolean }) {
  const [state, action, pending] = useActionState<FamilyAccessResult, FormData>(createFamilyAccessAction, {});

  return (
    <div className="space-y-4">
      <form action={action}>
        <input type="hidden" name="patient_id" value={patientId} />
        <button
          disabled={pending}
          className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Generando…" : hayActivo ? "Generar tarjeta nueva (anula la anterior)" : "Generar tarjeta de acceso"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>}

      {state.url && state.pin && state.qr && (
        <div>
          <div className="print-card mx-auto max-w-sm rounded-2xl border-2 border-slate-300 bg-white p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Profesionales SRL · Internación domiciliaria</p>
            <h3 className="text-base font-semibold text-slate-900 mt-1">Visitas de {patientName}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.qr} alt="Código QR de acceso" className="mx-auto my-3 h-48 w-48" />
            <p className="text-sm text-slate-700">Escaneá el código con la cámara del celular e ingresá este PIN:</p>
            <p className="text-3xl font-bold tracking-[0.3em] text-slate-900 my-2">{state.pin}</p>
            {state.expires_at && <p className="text-xs text-slate-500">Vence el {fecha(state.expires_at)}.</p>}
            <p className="text-[11px] text-slate-400 mt-2 break-all">{state.url}</p>
            <p className="text-[11px] text-slate-500 mt-2">Acceso personal: no compartas el PIN ni el link.</p>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 print:hidden">
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50">
              Imprimir tarjeta
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(state.url ?? "")}
              className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
            >
              Copiar link
            </button>
          </div>
          <p className="text-xs text-amber-700 text-center mt-3 print:hidden">
            El PIN se muestra solo ahora: si cerrás esta pantalla sin imprimirlo, hay que generar una tarjeta nueva.
          </p>
        </div>
      )}
    </div>
  );
}
