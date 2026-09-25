export default function PageHeader({
icon,
title,
section,
purpose,
description,
}: {
icon: React.ReactNode;
title: string;
section?: string;
/** Una frase en criollo: para qué sirve esta pantalla y qué acción dispara. */
purpose: string;
/** Nota técnica/trazabilidad al DF-Cx — se muestra más chica, debajo. */
description?: string;
}) {
return (
<div className="flex items-start gap-4 animate-fade-slide-up">
<span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shrink-0 shadow-sm">
{icon}
</span>
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
<h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
{section && (
<span className="text-[11px] font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
{section}
</span>
)}
</div>
<p className="text-sm text-slate-700 mt-1.5 max-w-2xl font-medium">{purpose}</p>
{description && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{description}</p>}
</div>
</div>
);
}
