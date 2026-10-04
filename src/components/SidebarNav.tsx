"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavIconId } from "@/lib/auth";
import { IconBox, IconTruck, IconRefresh, IconChart, IconUsers, IconClipboard, IconCalendar, IconSignature, IconBuilding, IconCash, IconClipboardCheck, IconGrid, IconStethoscope } from "@/components/icons";

const ICONS: Record<NavIconId, React.ComponentType<{ className?: string }>> = {
catalogo: IconBox,
pedidos: IconTruck,
seguimiento: IconRefresh,
pacientes: IconUsers,
dashboard: IconChart,
internacion: IconClipboard,
agenda: IconCalendar,
evoluciones: IconSignature,
obras_sociales: IconBuilding,
facturacion: IconCash,
compras: IconClipboardCheck,
inicio: IconGrid,
ayuda: IconStethoscope,
auditoria: IconClipboardCheck,
};

type NavItem = { href: string; label: string; icon: NavIconId; description: string };

export default function SidebarNav({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
const pathname = usePathname();

return (
<nav className="flex flex-col gap-1">
{nav.map((item, i) => {
const Icon = ICONS[item.icon];
const active = pathname === item.href || pathname?.startsWith(item.href + "/");
return (
<Link
key={item.href}
href={item.href}
onClick={onNavigate}
className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 animate-slide-in-left stagger-${i + 1} ${
active
? "bg-white/10 text-white shadow-inner"
: "text-slate-400 hover:text-white hover:bg-white/5"
}`}
>
{active && (
<span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-[#4CAF50] to-[#0095A8]" />
)}
<span className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200 ${active ? "bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white" : "bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10"}`}>
<Icon className="w-4.5 h-4.5" />
</span>
<span className="flex flex-col">
<span>{item.label}</span>
<span className={`text-[11px] font-normal ${active ? "text-slate-300" : "text-slate-500"}`}>{item.description}</span>
</span>
</Link>
);
})}
</nav>
);
}
