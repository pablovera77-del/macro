"use client";

import { useEffect, useRef, useState } from "react";

// Recuadro para firmar con el dedo o el mouse. La firma viaja como imagen PNG
// en el campo oculto `name` (data URL), listo para guardarse con el remito.
export default function SignaturePad({
  name = "firma_png",
  onStart,
}: {
  name?: string;
  onStart?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const startedRef = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    if (!startedRef.current) {
      startedRef.current = true;
      onStart?.();
    }
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current;
    if (c) setValue(c.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    setValue("");
  }

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={value} />
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Recuadro para la firma"
        className="w-full h-36 sm:h-40 rounded-xl border-2 border-dashed border-slate-300 bg-white touch-none cursor-crosshair"
      />
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{value ? "Firma lista." : "Firmá acá con el dedo o el mouse."}</span>
        <button type="button" onClick={clear} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
          Borrar y firmar de nuevo
        </button>
      </div>
    </div>
  );
}
