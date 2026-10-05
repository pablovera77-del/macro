"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconMapPin } from "@/components/icons";

/**
 * Firma dibujada con el dedo (o el mouse). Deja tres campos ocultos en el formulario:
 * `<name>_img` (PNG), `<name>_lat` y `<name>_lng` (ubicación, opcional: si el navegador no
 * la da, la firma vale igual — mismo criterio que el consentimiento de ingreso).
 * La ubicación se pide sola al terminar el primer trazo y se puede reintentar con el botón.
 */
export default function FirmaCanvas({
  name,
  titulo,
  ayuda,
  disabled = false,
}: {
  name: string;
  titulo: string;
  ayuda?: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const dataUrlRef = useRef("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const askedLocation = useRef(false);

  const fit = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width < 10) return; // oculto (por ejemplo, dentro de un panel cerrado)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (c.width === w && c.height === h) return;
    c.width = w;
    c.height = h;
    const prev = dataUrlRef.current;
    if (prev) {
      const img = new Image();
      img.onload = () => c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      img.src = prev;
    }
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [fit]);

  function point(ev: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: ((ev.clientX - rect.left) / rect.width) * c.width, y: ((ev.clientY - rect.top) / rect.height) * c.height };
  }

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
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

  function onDown(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const c = canvasRef.current!;
    fit();
    c.setPointerCapture(ev.pointerId);
    drawing.current = true;
    last.current = point(ev);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, Math.max(1, c.width / 400), 0, Math.PI * 2);
    ctx.fill();
  }

  function onMove(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = point(ev);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2, c.width / 220);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current!;
    const url = c.toDataURL("image/png");
    dataUrlRef.current = url;
    setDataUrl(url);
    if (!askedLocation.current) {
      askedLocation.current = true;
      locate();
    }
  }

  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dataUrlRef.current = "";
    setDataUrl("");
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <span className="text-xs font-medium text-slate-700">
          {titulo} <span className="text-red-500">*</span>
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={locate}
            className={`inline-flex items-center gap-1 rounded-lg text-[11px] font-medium px-2 py-1.5 transition-colors ${
              coords ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <IconMapPin className="w-3 h-3" />
            {locating ? "Ubicando..." : coords ? "Ubicación capturada" : "Capturar ubicación"}
          </button>
          <button type="button" onClick={clear} className="rounded-lg text-[11px] font-medium px-2 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100">
            Borrar y firmar de nuevo
          </button>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label={`${titulo}: dibujá tu firma con el dedo o el mouse`}
        className={`block w-full h-36 rounded-xl border-2 border-dashed bg-white ${dataUrl ? "border-emerald-400" : "border-slate-300"}`}
        style={{ touchAction: "none" }}
      />
      <p className="text-[11px] text-slate-400 mt-1">{dataUrl ? "Firma registrada." : ayuda ?? "Dibujá la firma dentro del recuadro."}</p>
      <input type="hidden" name={`${name}_img`} value={dataUrl} />
      <input type="hidden" name={`${name}_lat`} value={coords?.lat ?? ""} />
      <input type="hidden" name={`${name}_lng`} value={coords?.lng ?? ""} />
    </div>
  );
}
