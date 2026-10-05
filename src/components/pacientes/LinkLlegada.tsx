"use client";

import { useState, useTransition } from "react";
import { generarLinkLlegadaAction } from "@/app/(dashboard)/internacion/actions";
import { linkWhatsapp } from "@/lib/reminders";

/**
 * Link de llegada para la familia (DF-C3 §12): se genera acá, se copia o se manda por WhatsApp. La familia lo abre
 * sin cuenta y confirma con un botón que el paciente llegó. Vale 48 horas; generar uno nuevo anula el anterior.
 */
export default function LinkLlegada({
  patientId,
  pacienteNombre,
  telefonoResponsable,
  responsableNombre,
}: {
  patientId: string;
  pacienteNombre: string;
  telefonoResponsable: string | null;
  responsableNombre: string | null;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [vence, setVence] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pending, start] = useTransition();

  function generar() {
    setError(null);
    setCopiado(false);
    start(async () => {
      const r = await generarLinkLlegadaAction(patientId);
      if (!r.ok || !r.token) {
        setError(r.error ?? "No se pudo generar el link. Probá de nuevo.");
        return;
      }
      setLink(`${window.location.origin}/llegada/${r.token}`);
      setVence(r.vence ? new Date(r.vence).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" }) : null);
    });
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles: el campo de texto queda seleccionable para copiar a mano.
      setCopiado(false);
    }
  }

  const nombre = pacienteNombre.split(" ")[0];
  const wa = link
    ? linkWhatsapp(telefonoResponsable, `Hola${responsableNombre ? ` ${responsableNombre.split(" ")[0]}` : ""}, te escribimos de Profesionales SRL. Cuando ${nombre} llegue a su domicilio, confirmalo tocando este link (sirve 48 horas): ${link}`)
    : null;

  return (
    <div className="space-y-2">
      {!link && (
        <button type="button" onClick={generar} disabled={pending} className="rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-50 disabled:opacity-60">
          {pending ? "Generando…" : "Generar link de llegada para la familia"}
        </button>
      )}
      {error && <p role="alert" className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">{error}</p>}
      {link && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs text-slate-600">Mandale este link al familiar responsable. Cuando el paciente llegue, lo abre y toca un botón: el paciente pasa a «Activo» solo.{vence ? ` Sirve hasta el ${vence}.` : ""}</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700" aria-label="Link de llegada" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800">{copiado ? "✓ Copiado" : "Copiar link"}</button>
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-2 hover:bg-emerald-700">Enviar por WhatsApp</a>
            ) : (
              <span className="text-xs text-amber-700 self-center">Sin teléfono válido de la persona responsable: copiá el link y mandalo por otro medio.</span>
            )}
            <button type="button" onClick={generar} disabled={pending} className="rounded-lg border border-slate-300 bg-white text-slate-600 text-xs font-medium px-3 py-2 hover:bg-slate-50 disabled:opacity-60">Generar uno nuevo</button>
          </div>
        </div>
      )}
    </div>
  );
}
