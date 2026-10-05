"use client";

import { useEffect, useState } from "react";

function readFlash(): string | null {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith("flash="));
    if (!m) return null;
    document.cookie = "flash=; path=/; max-age=0";
    return decodeURIComponent(m.slice("flash=".length));
  } catch {
    return null;
  }
}

/** Muestra el mensaje de confirmación que dejó la última acción (ver lib/flash.ts). */
export default function FlashToast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const m = readFlash();
      if (m) setMsg(m);
    }, 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(id);
  }, [msg]);

  if (!msg) return null;
  return (
    <div role="status" aria-live="polite" className="fixed top-[72px] lg:top-auto lg:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-md animate-fade-slide-up">
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-700 text-white shadow-xl px-4 py-3 text-sm">
        <span aria-hidden className="mt-0.5">✓</span>
        <p className="flex-1">{msg}</p>
        <button type="button" onClick={() => setMsg(null)} aria-label="Cerrar mensaje" className="no-touch -my-1 px-2 py-1 text-lg leading-none text-emerald-100 hover:text-white">×</button>
      </div>
    </div>
  );
}
