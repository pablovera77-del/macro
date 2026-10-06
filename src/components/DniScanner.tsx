"use client";

import { useEffect, useRef, useState } from "react";
import { parseDniPdf417, type DatosDni } from "@/lib/dni-pdf417";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Lee el código PDF417 del dorso del DNI con la cámara y devuelve nombre, apellido, DNI, nacimiento y sexo.
 * Usa el lector del navegador (BarcodeDetector, disponible en Chrome y Edge de celulares y computadoras).
 * Si el navegador no lo tiene, avisa y el alta sigue a mano. El domicilio del DNI no viene en el código: se carga aparte.
 */
export default function DniScanner({ onResult }: { onResult: (d: DatosDni) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function cerrar() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (!BD || !navigator.mediaDevices?.getUserMedia) {
        setMsg("Este navegador no puede leer el código del DNI. Cargá los datos a mano o probá con Chrome en el celular.");
        setAbierto(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!activo) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        const det = new BD({ formats: ["pdf417"] });
        const tick = async () => {
          if (!activo) return;
          try {
            const r = await det.detect(v);
            for (const c of r) {
              const d = parseDniPdf417(c.rawValue);
              if (d) {
                setMsg(`DNI leído: ${d.apellido} ${d.nombre}. Revisá los datos.`);
                onResult(d);
                cerrar();
                return;
              }
            }
          } catch { /* un cuadro sin código no es un error */ }
          timer = setTimeout(tick, 350);
        };
        tick();
      } catch {
        setMsg("No pudimos abrir la cámara. Revisá el permiso del navegador o cargá los datos a mano.");
        setAbierto(false);
      }
    })();
    return () => { activo = false; if (timer) clearTimeout(timer); streamRef.current?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return (
    <div className="sm:col-span-2">
      {!abierto ? (
        <button type="button" onClick={() => { setMsg(null); setAbierto(true); }} className="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50">
          Leer el DNI con la cámara
        </button>
      ) : (
        <div className="rounded-xl border border-slate-300 bg-black/90 p-2 max-w-sm">
          <video ref={videoRef} playsInline muted className="w-full rounded-lg" />
          <p className="text-[11px] text-slate-200 mt-1">Apuntá al código de barras del dorso del DNI.</p>
          <button type="button" onClick={cerrar} className="mt-1 text-xs text-white underline">Cancelar</button>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-slate-600 mt-1">{msg}</p>}
      <p className="text-[11px] text-slate-400 mt-1">Completa DNI, nombre, fecha de nacimiento y sexo. El domicilio del DNI no viene en el código: escribilo en el campo de domicilio y, si el paciente vive en otro lugar, agregá el domicilio de atención.</p>
    </div>
  );
}
