"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconBox, IconTruck, IconRefresh, IconChart, IconClipboard, IconSignature, IconStethoscope } from "@/components/icons";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";

const DEMO_ACCOUNTS = [
{ label: "Depósito", email: "deposito.demo@profesionales-srl.test", icon: IconBox, tone: "from-teal-500 to-teal-600" },
{ label: "Administración", email: "administracion.demo@profesionales-srl.test", icon: IconTruck, tone: "from-violet-500 to-violet-600" },
{ label: "Transporte", email: "transporte.demo@profesionales-srl.test", icon: IconRefresh, tone: "from-amber-500 to-amber-600" },
{ label: "Dirección", email: "direccion.demo@profesionales-srl.test", icon: IconChart, tone: "from-emerald-500 to-emerald-600" },
{ label: "Coordinación Internación", email: "coordinador.demo@profesionales-srl.test", icon: IconClipboard, tone: "from-rose-500 to-rose-600" },
{ label: "Profesional Asistencial", email: "profesional.demo@profesionales-srl.test", icon: IconSignature, tone: "from-teal-500 to-teal-600" },
{ label: "Médico Coordinador", email: "medico.demo@profesionales-srl.test", icon: IconStethoscope, tone: "from-indigo-500 to-indigo-600" },
];
const DEMO_PASSWORD = "DfC5Demo2026!";

export default function LoginPage() {
const router = useRouter();
const supabase = createClient();
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);

async function handleSubmit(e: React.FormEvent) {
e.preventDefault();
setLoading(true);
setError(null);
const { error } = await supabase.auth.signInWithPassword({ email, password });
setLoading(false);
if (error) {
setError(error.message);
return;
}
router.push("/");
router.refresh();
}

function fillDemo(demoEmail: string) {
setEmail(demoEmail);
setPassword(DEMO_PASSWORD);
}

return (
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b2a27] via-[#0f3d38] to-[#153f3a] px-4 py-10 relative overflow-hidden">
<div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#4CAF50]/20 blur-3xl" />
<div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#0095A8]/20 blur-3xl" />

<div className="w-full max-w-sm space-y-6 relative animate-scale-in">
<div className="text-center">
<div className="mx-auto flex items-center justify-center bg-white/95 rounded-2xl shadow-lg px-8 py-6 mb-4 w-fit">
<span className="inline-flex flex-col items-center gap-2">
<BrandMark className="h-14 w-14" />
<BrandWordmark theme="color" tagline className="text-3xl" />
</span>
</div>
<p className="text-sm text-slate-400 mt-1">
Plataforma de gestión de internación domiciliaria
</p>
</div>

<form onSubmit={handleSubmit} className="space-y-4 bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl animate-fade-slide-up stagger-1">
<div>
<label className="block text-sm font-medium text-slate-200 mb-1.5">Email</label>
<input
type="email"
required
value={email}
onChange={(e) => setEmail(e.target.value)}
className="w-full rounded-xl border border-white/15 bg-white/[0.04] text-white placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/50 transition-shadow"
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-200 mb-1.5">Contraseña</label>
<input
type="password"
required
value={password}
onChange={(e) => setPassword(e.target.value)}
className="w-full rounded-xl border border-white/15 bg-white/[0.04] text-white placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/50 transition-shadow"
/>
</div>
{error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
<button
type="submit"
disabled={loading}
className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-green)] text-white text-sm font-medium py-2.5 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-black/30"
>
{loading ? "Ingresando..." : "Ingresar"}
</button>
</form>

<div className="bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/10 p-4 animate-fade-slide-up stagger-2">
<p className="text-xs font-medium text-slate-400 mb-3">
Cuentas demo (mockup, no reales)
</p>
<div className="grid grid-cols-2 gap-2">
{DEMO_ACCOUNTS.map((acc) => {
const Icon = acc.icon;
return (
<button
key={acc.email}
type="button"
onClick={() => fillDemo(acc.email)}
className="flex items-center gap-2 text-xs rounded-xl border border-white/10 px-2.5 py-2 hover:bg-white/10 text-slate-200 transition-colors text-left"
>
<span className={`flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${acc.tone} text-white shrink-0`}>
<Icon className="w-3.5 h-3.5" />
</span>
{acc.label}
</button>
);
})}
</div>
<p className="text-[11px] text-slate-500 mt-3">
Contraseña: <span className="font-mono text-slate-400">{DEMO_PASSWORD}</span>
</p>
</div>
</div>
</div>
);
}
