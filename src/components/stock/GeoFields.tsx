"use client";

import type { GeoState } from "./useGeolocation";

// Campos ocultos con la ubicación y un texto que dice si quedó registrada.
export default function GeoFields({ geo, onRetry }: { geo: GeoState; onRetry: () => void }) {
  return (
    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
      <input type="hidden" name="lat" value={geo.lat ?? ""} />
      <input type="hidden" name="lng" value={geo.lng ?? ""} />
      {geo.status === "ok" && <span className="text-emerald-700">Ubicación registrada{geo.precision ? ` (±${Math.round(geo.precision)} m)` : ""}.</span>}
      {geo.status === "pidiendo" && <span>Buscando tu ubicación…</span>}
      {(geo.status === "idle" || geo.status === "no") && (
        <>
          <span>{geo.status === "no" ? "No pudimos tomar tu ubicación; podés seguir igual." : "Se registra la ubicación al confirmar."}</span>
          <button type="button" onClick={onRetry} className="underline text-slate-600">
            Registrar mi ubicación
          </button>
        </>
      )}
    </div>
  );
}
