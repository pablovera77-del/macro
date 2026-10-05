"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// El navegador expone el reconocimiento de voz con distintos nombres y sin tipos oficiales.
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
};
type Constructor = new () => Reconocimiento;

function getRecognition(): Constructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Botón de micrófono para dictar dentro de un cuadro de texto. Escribe lo que se dicta al
 * final del texto. Si el navegador no soporta dictado (por ejemplo Firefox), no se muestra
 * y el cuadro funciona igual con el teclado.
 */
export default function DictadoButton({ target }: { target: React.RefObject<HTMLTextAreaElement | null> }) {
  // Solo se sabe si hay dictado una vez en el navegador (en el servidor siempre es "no").
  const soportado = useSyncExternalStore(
    () => () => {},
    () => getRecognition() !== null,
    () => false
  );
  const [escuchando, setEscuchando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const rec = useRef<Reconocimiento | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  if (!soportado) return null;

  function agregar(texto: string) {
    const ta = target.current;
    if (!ta || !texto.trim()) return;
    const sep = ta.value && !/\s$/.test(ta.value) ? " " : "";
    // Se asigna con el setter nativo para que el formulario se entere del cambio.
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(ta, ta.value + sep + texto.trim());
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function alternar() {
    if (escuchando) {
      rec.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    setAviso(null);
    const r = new Ctor();
    r.lang = "es-AR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) agregar(ev.results[i][0].transcript);
      }
    };
    r.onerror = (ev) => {
      setAviso(ev.error === "not-allowed" ? "Permitile al navegador usar el micrófono para dictar." : "No se pudo dictar. Probá de nuevo o escribí con el teclado.");
    };
    r.onend = () => setEscuchando(false);
    rec.current = r;
    setEscuchando(true);
    r.start();
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={alternar}
        aria-pressed={escuchando}
        className={`inline-flex items-center gap-1 rounded-lg text-[11px] font-medium px-2 py-1.5 transition-colors ${
          escuchando ? "bg-red-100 text-red-700 ring-1 ring-red-300" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {escuchando ? "Escuchando… tocá para parar" : "Dictar"}
      </button>
      {aviso && <span className="text-[11px] text-red-600 mt-1 max-w-[240px] text-right">{aviso}</span>}
    </span>
  );
}
