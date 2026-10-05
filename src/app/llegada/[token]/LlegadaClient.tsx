"use client";

import { useState, useTransition } from "react";
import { confirmarLlegadaFamiliaAction, type LlegadaResultado } from "../actions";

type Info = { ok: boolean; error?: string; ya_confirmado?: boolean; nombre?: string };

export default function LlegadaClient({ token, info }: { token: string; info: Info }) {
  const [resultado, setResultado] = useState<LlegadaResultado | null>(null);
  const [pending, start] = useTransition();

  const confirmado = resultado?.ok || (info.ok && info.ya_confirmado);
  if (confirmado) {
    return (
      <>
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl" aria-hidden>✓</div>
        <h1 className="text-xl font-semibold text-slate-900">¡Gracias! Registramos la llegada</h1>
        <p className="text-sm text-slate-600">
          {info.nombre ? `${info.nombre} ya figura como recibido en su domicilio.` : "El paciente ya figura como recibido en su domicilio."} Nuestro equipo va a coordinar las visitas. Ya podés cerrar esta página.
        </p>
      </>
    );
  }

  const error = resultado && !resultado.ok ? resultado.error : !info.ok ? info.error : null;
  if (error === "vencido") {
    return (
      <>
        <h1 className="text-xl font-semibold text-slate-900">El link ya venció</h1>
        <p className="text-sm text-slate-600">Este link sirve durante 48 horas. Pedile al equipo de Profesionales que te envíe uno nuevo, o avisales por teléfono que llegó.</p>
      </>
    );
  }
  if (error === "invalido" || error === "error") {
    return (
      <>
        <h1 className="text-xl font-semibold text-slate-900">No pudimos abrir este link</h1>
        <p className="text-sm text-slate-600">
          {error === "error" ? "Hubo un problema al registrar la llegada. Probá de nuevo en unos minutos." : "El link no es válido o ya no está activo. Revisá que lo hayas copiado completo o pedí uno nuevo al equipo de Profesionales."}
        </p>
        {error === "error" && (
          <button type="button" onClick={() => setResultado(null)} className="rounded-xl bg-slate-900 text-white font-medium px-5 py-3 text-base w-full">Volver a intentar</button>
        )}
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Confirmá la llegada{info.nombre ? ` de ${info.nombre}` : ""}</h1>
      <p className="text-sm text-slate-600">Cuando el paciente ya esté en su domicilio, tocá el botón. Así el equipo sabe que puede empezar con las visitas.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResultado(await confirmarLlegadaFamiliaAction(token)))}
        className="w-full rounded-xl bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white font-semibold px-5 py-4 text-base shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Confirmando…" : "Confirmo que llegó al domicilio"}
      </button>
      <p className="text-xs text-slate-400">Si tocaste el link por error, simplemente cerrá esta página.</p>
    </>
  );
}
