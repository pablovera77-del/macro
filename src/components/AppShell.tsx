"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppRole, NavIconId } from "@/lib/auth";
import SidebarNav from "@/components/SidebarNav";
import { IconLogout, IconMenu } from "@/components/icons";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";

type NavItem = { href: string; label: string; icon: NavIconId; description: string };
type Accent = { bg: string; text: string; ring: string; dot: string };

export default function AppShell({
nav,
fullName,
roleLabel,
accent,
logout,
search,
children,
}: {
nav: NavItem[];
fullName: string;
roleLabel: string;
accent: Accent;
logout: React.ReactNode;
search?: React.ReactNode;
children: React.ReactNode;
}) {
const [open, setOpen] = useState(false);

const initials = fullName
.split(" ")
.filter(Boolean)
.slice(0, 2)
.map((n) => n[0]?.toUpperCase())
.join("");

const SidebarContent = (
<div className="flex flex-col h-full">
<div className="px-5 pt-6 pb-5">
<Link href="/" className="flex flex-col gap-2">
<span className="inline-flex items-center gap-2.5">
<BrandMark className="h-8 w-8" />
<BrandWordmark theme="light" className="text-xl" />
</span>
<span className="text-[11px] text-slate-400 pl-0.5">Gestión de internación domiciliaria</span>
</Link>
</div>

<div className="px-3 flex-1 overflow-y-auto">
<SidebarNav nav={nav} onNavigate={() => setOpen(false)} />
</div>

<div className="px-3 pb-4 pt-3 border-t border-white/10 mx-3">
<div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2 ring-1 ${accent.bg} ${accent.ring}`}>
<span className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${accent.text} bg-white/10`}>
{initials || "?"}
</span>
<span className="flex flex-col leading-tight min-w-0">
<span className="text-sm font-medium text-white truncate">{fullName}</span>
<span className={`text-[11px] ${accent.text}`}>{roleLabel}</span>
</span>
</div>
{logout}
</div>
</div>
);

return (
<div className="min-h-screen flex bg-[var(--background)]">
{/* Desktop sidebar */}
<aside className="hidden lg:flex lg:flex-col w-[260px] shrink-0 bg-gradient-to-b from-[var(--sidebar-bg)] to-[var(--sidebar-bg-2)] sticky top-0 h-screen">
{SidebarContent}
</aside>

{/* Mobile drawer */}
{open && (
<div className="lg:hidden fixed inset-0 z-40">
<div className="absolute inset-0 bg-slate-900/60 animate-fade-in" onClick={() => setOpen(false)} />
<aside className="absolute left-0 top-0 h-full w-[280px] bg-gradient-to-b from-[var(--sidebar-bg)] to-[var(--sidebar-bg-2)] animate-slide-in-left">
{SidebarContent}
</aside>
</div>
)}

<div className="flex-1 min-w-0 flex flex-col">
<header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between">
<Link href="/" className="flex items-center">
<span className="inline-flex items-center gap-2.5">
<BrandMark className="h-7 w-7" />
<BrandWordmark theme="color" className="text-lg" />
</span>
</Link>
<button
onClick={() => setOpen(true)}
className="flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
aria-label="Abrir menú"
>
<IconMenu className="w-5 h-5" />
</button>
</header>

<main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
{search && <div className="mb-5 flex justify-end">{search}</div>}
{children}
</main>
</div>
</div>
);
}

export function LogoutButton({ action }: { action: () => void }) {
return (
<form action={action}>
<button className="w-full flex items-center gap-2 justify-center rounded-xl border border-white/10 text-slate-300 text-xs font-medium px-3 py-2 hover:bg-white/5 hover:text-white transition-colors">
<IconLogout className="w-4 h-4" />
Cerrar sesión
</button>
</form>
);
}
