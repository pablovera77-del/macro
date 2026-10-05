"use client";

import { useState } from "react";

// Foto desde la cámara del celular (o un archivo en la compu). Se reduce a ~1280 px antes de
// enviarla y viaja como imagen en el campo oculto `name`; el servidor la guarda en el
// almacenamiento privado de fotos.
export default function PhotoField({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("No se pudo abrir la imagen."));
        i.src = url;
      });
      const max = 1280;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      setValue(c.toDataURL("image/jpeg", 0.72));
    } catch {
      setErr("No se pudo leer la foto. Probá sacarla de nuevo.");
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-slate-600 font-medium">
        {label} {required && <span className="text-red-600">(obligatoria)</span>}
      </span>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-2 cursor-pointer hover:bg-slate-50">
          {value ? "Cambiar foto" : busy ? "Procesando…" : "Sacar o elegir foto"}
          <input type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" />
        </label>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Vista previa de la foto" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
        )}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
