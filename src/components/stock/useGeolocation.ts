"use client";

import { useCallback, useState } from "react";

export type GeoState = { status: "idle" | "pidiendo" | "ok" | "no"; lat: number | null; lng: number | null; precision: number | null };

// Pide la ubicación del dispositivo SOLO cuando se la invoca (no al abrir la pantalla),
// para no llenar de avisos del navegador. Si el usuario no la da, el trámite sigue igual.
export function useGeolocation() {
  const [geo, setGeo] = useState<GeoState>({ status: "idle", lat: null, lng: null, precision: null });
  const pedir = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ status: "no", lat: null, lng: null, precision: null });
      return;
    }
    setGeo((g) => ({ ...g, status: "pidiendo" }));
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ status: "ok", lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      () => setGeo({ status: "no", lat: null, lng: null, precision: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);
  return { geo, pedir };
}
