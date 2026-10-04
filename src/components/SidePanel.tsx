"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Panel lateral para formularios de alta (D3). Antes cada formulario vivía al
 * final de la página y había que scrollear hasta encontrarlo. Ahora el botón
 * principal del encabezado (href="#<id>") abre este panel a la derecha, sin
 * perder el lugar en la lista.
 *
 * - Se abre cuando la URL termina en #<id> (también al llegar desde otra
 *   pantalla o desde un link "Programar" con parámetros).
 * - Se cierra con Esc, con la X, haciendo click afuera, o al enviar el formulario.
 * - Los hijos quedan siempre montados: así el formulario no pierde lo escrito
 *   si el panel se cierra por error y se vuelve a abrir.
 */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}
const notify = () => listeners.forEach((l) => l());
const getHash = () => window.location.hash;
const getServerHash = () => "";

export default function SidePanel({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  // La URL (#id) es la fuente de verdad. Next.js no siempre dispara "hashchange"
  // al navegar con <Link>, pero sí vuelve a renderizar con la nueva URL, y ahí se
  // vuelve a leer el valor.
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const open = hash === `#${id}`;

  const close = useCallback(() => {
    if (window.location.hash === `#${id}`) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      notify();
    }
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div id={id} aria-hidden={!open}>
      <div
        onClick={close}
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full invisible"}`}
        style={open ? undefined : { transitionProperty: "transform, visibility" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar panel"
            className="rounded-lg px-2.5 py-1 text-slate-500 hover:bg-slate-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div
          className="side-panel-body flex-1 overflow-y-auto p-5"
          onSubmitCapture={() => {
            // El envío lo procesa la acción del servidor; cerramos enseguida para
            // que se vea la lista actualizada y el aviso de confirmación.
            setTimeout(close, 150);
          }}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
