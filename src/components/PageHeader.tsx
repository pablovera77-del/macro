// Las referencias al documento funcional (section/description) son para el equipo
// de desarrollo: se muestran solo si NEXT_PUBLIC_SHOW_TRACE=1. El personal de la
// clínica ve únicamente el título, el propósito y la acción principal.
const SHOW_TRACE = process.env.NEXT_PUBLIC_SHOW_TRACE === "1";

export default function PageHeader({
  icon,
  title,
  section,
  badge,
  purpose,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  section?: string;
  /** Etiqueta corta siempre visible (ej. el nombre del rol). */
  badge?: string;
  /** Una frase en criollo: para qué sirve esta pantalla y qué acción dispara. */
  purpose: string;
  /** Nota técnica/trazabilidad al DF-Cx — se muestra más chica, debajo. */
  description?: string;
  /**
   * Acción principal de la pantalla (ej. "+ Nuevo paciente"). Se muestra como
   * botón destacado arriba a la derecha y lleva al formulario correspondiente
   * (ancla "#id"). Antes los formularios de alta estaban al final de la página
   * y nadie los encontraba.
   */
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start gap-4 animate-fade-slide-up">
      <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shrink-0 shadow-sm">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
          {badge && (
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{badge}</span>
          )}
          {SHOW_TRACE && section && (
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
              {section}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 mt-1.5 max-w-2xl font-medium">{purpose}</p>
        {SHOW_TRACE && description && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{description}</p>}
      </div>
      {action && (
        <a
          href={action.href}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white text-sm font-semibold px-4 py-2.5 shadow-sm hover:opacity-90 transition-opacity"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
