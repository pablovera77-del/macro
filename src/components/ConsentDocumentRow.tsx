"use client";

import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { IconMapPin, IconSignature } from "@/components/icons";

// DF-C2 §6, resuelto legal hoy: cada documento se firma por separado — nunca
// una sola firma para varios. Cada fila de esta lista es su propio mini-paso
// del wizard de admisión, con su propio botón "Acepto" y su propio registro
// (firmante, fecha/hora, geolocalización best-effort vía navigator.geolocation;
// si el navegador no da permiso, se guarda igual sin coordenadas — no bloquea
// la firma, DF-C2 no pide que el GPS sea obligatorio para que el consentimiento
// sea válido).
export default function ConsentDocumentRow({
  signAction,
  patientId,
  documentId,
  titulo,
  resumen,
  requiereFirmaProfesional,
  profesionales,
  firmado,
  canSign,
  detalle,
  bloqueadoPor,
}: {
  signAction: (formData: FormData) => Promise<void>;
  patientId: string;
  documentId: string;
  titulo: string;
  resumen: string | null;
  requiereFirmaProfesional: boolean;
  profesionales: { id: string; full_name: string }[];
  firmado: { firmante_nombre: string; firmado_at: string; profesional_id: string | null } | null;
  canSign: boolean;
  /** Datos del paciente que quedan incluidos en el documento (R PFS 05): se muestran antes del «Acepto». */
  detalle?: React.ReactNode;
  /** Título del consentimiento anterior si todavía no se firmó: este paso espera (los pasos se firman en orden). */
  bloqueadoPor?: string | null;
}) {
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  function captureLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 5000 }
    );
  }

  if (firmado) {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <StatusBadge tone="verde" label="Firmado" />
          <span className="text-slate-700">{titulo}</span>
          <span className="text-xs text-slate-400">
            {firmado.firmante_nombre} · {new Date(firmado.firmado_at).toLocaleString("es-AR")}
            {requiereFirmaProfesional && (firmado.profesional_id ? " · con firma profesional" : " · falta firma profesional")}
          </span>
        </div>
        {detalle && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-slate-500 underline underline-offset-2">Ver los datos incluidos en este consentimiento</summary>
            {detalle}
          </details>
        )}
      </div>
    );
  }

  if (bloqueadoPor) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-sm py-1.5 border-b border-slate-100 last:border-0 opacity-80">
        <StatusBadge tone="gris" label="Espera" />
        <span className="text-slate-700">{titulo}</span>
        <span className="text-xs text-slate-500">Primero tiene que firmarse «{bloqueadoPor}».</span>
      </div>
    );
  }

  if (!canSign) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-sm py-1.5 border-b border-slate-100 last:border-0">
        <StatusBadge tone="gris" label="Pendiente" />
        <span className="text-slate-700">{titulo}</span>
      </div>
    );
  }

  return (
    <div className="py-1.5 border-b border-slate-100 last:border-0">
    {detalle && (
      <div className="mb-2">
        <div className="text-sm font-medium text-slate-900">{titulo}</div>
        {detalle}
        <p className="text-[11px] text-slate-500 mt-1">Leé estos datos con el familiar responsable antes de tocar «Acepto».</p>
      </div>
    )}
    <form action={signAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="legal_document_id" value={documentId} />
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <StatusBadge tone="gris" label="Pendiente" />
      {!detalle && (
        <div className="min-w-[160px]">
          <div className="text-sm text-slate-900">{titulo}</div>
          {resumen && <div className="text-[11px] text-slate-400">{resumen}</div>}
        </div>
      )}
      <input
        name="firmante_nombre"
        placeholder="Nombre de quien firma (paciente/familiar)"
        required
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[180px]"
      />
      {requiereFirmaProfesional && (
        <select name="profesional_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">Profesional actuante...</option>
          {profesionales.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={captureLocation}
        className={`inline-flex items-center gap-1 rounded-lg text-[11px] font-medium px-2 py-1.5 transition-colors ${
          coords ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
        }`}
      >
        <IconMapPin className="w-3 h-3" />
        {locating ? "Ubicando..." : coords ? "Ubicación capturada" : "Capturar ubicación"}
      </button>
      <button className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
        <IconSignature className="w-3.5 h-3.5" /> Acepto
      </button>
    </form>
    </div>
  );
}
