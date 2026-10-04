"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconBox, IconTruck, IconRefresh, IconChart, IconClipboard, IconStethoscope } from "@/components/icons";
import { ROLE_LABELS } from "@/lib/roles";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";

const DEMO_ACCOUNTS = [
{ role: "administracion" as const, hint: "Alta de pacientes y facturación", email: "administracion.demo@profesionales-srl.test", icon: IconTruck, tone: "from-violet-500 to-violet-600" },
{ role: "coordinador_internacion" as const, hint: "Agenda y llegada de pacientes", email: "coordinador.demo@profesionales-srl.test", icon: IconClipboard, tone: "from-rose-500 to-rose-600" },
{ role: "profesional_asistencial" as const, hint: "Mis visitas y evoluciones", email: "profesional.demo@profesionales-srl.test", icon: IconStethoscope, tone: "from-teal-500 to-teal-600" },
{ role: "deposito" as const, hint: "Catálogo y pedidos", email: "deposito.demo@profesionales-srl.test", icon: IconBox, tone: "from-sky-500 to-sky-600" },
{ role: "transporte" as const, hint: "Entregas y retiros", email: "transporte.demo@profesionales-srl.test", icon: IconRefresh, tone: "from-amber-500 to-amber-600" },
{ role: "direccion" as const, hint: "Tablero general", email: "direccion.demo@profesionales-srl.test", icon: IconChart, tone: "from-emerald-500 to-emerald-600" },
];
// Ingreso de un clic para demostraciones. Para apagarlo en una puesta en marcha
// con datos reales: NEXT_PUBLIC_DEMO_LOGIN=0 (también oculta la contraseña).
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGIN !== "0";
const DEMO_PASSWORD = "DfC5Demo2026!";

function LoginForm() {
const router = useRouter();
const supabase = createClient();
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [loadingRole, setLoadingRole] = useState<string | null>(null);
// A3: recuperar contraseña por mail. El mensaje es siempre el mismo, exista o no
// la cuenta, para no revelar qué mails están registrados.
const [modo, setModo] = useState<"ingresar" | "recuperar">("ingresar");
const [enviado, setEnviado] = useState(false);
const linkVencido = useSearchParams().get("error") === "link";

async function handleRecuperar(e: React.FormEvent) {
e.preventDefault();
setLoading(true);
setError(null);
await supabase.auth.resetPasswordForEmail(email, {
redirectTo: `${window.location.origin}/auth/callback?next=/restablecer`,
});
setLoading(false);
setEnviado(true);
}

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

// Un clic: inicia sesión directo con la cuenta de demostración del rol elegido.
async function loginAs(acc: (typeof DEMO_ACCOUNTS)[number]) {
setLoadingRole(acc.role);
setError(null);
const { error } = await supabase.auth.signInWithPassword({ email: acc.email, password: DEMO_PASSWORD });
if (error) {
setLoadingRole(null);
setError("No se pudo ingresar con la cuenta de demostración. Probá de nuevo en unos segundos.");
return;
}
router.push("/");
router.refresh();
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

<form onSubmit={modo === "ingresar" ? handleSubmit : handleRecuperar} className="space-y-4 bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl animate-fade-slide-up stagger-1">
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
{linkVencido && modo === "ingresar" && (
<p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">El link venció o ya se usó. Pedí uno nuevo con «Olvidé mi contraseña».</p>
)}
{modo === "ingresar" && (
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
)}
{modo === "recuperar" && (
<p className="text-xs text-slate-300">Escribí tu email y te enviamos un link para elegir una contraseña nueva.</p>
)}
{modo === "recuperar" && enviado && (
<p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">Si el email está registrado, te enviamos un link para cambiar la contraseña. Revisá también la carpeta de spam.</p>
)}
{error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
<button
type="submit"
disabled={loading}
className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-green)] text-white text-sm font-medium py-2.5 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-black/30"
>
{modo === "ingresar" ? (loading ? "Ingresando..." : "Ingresar") : loading ? "Enviando..." : "Enviarme el link"}
</button>
<button
type="button"
onClick={() => {
setModo(modo === "ingresar" ? "recuperar" : "ingresar");
setError(null);
setEnviado(false);
}}
className="w-full text-xs text-slate-300 hover:text-white underline underline-offset-2"
>
{modo === "ingresar" ? "Olvidé mi contraseña" : "Volver a ingresar"}
</button>
</form>

{DEMO_ENABLED && (
<div className="bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/10 p-4 animate-fade-slide-up stagger-2">
<p className="text-xs font-medium text-slate-300 mb-1">Entrar a la demostración</p>
<p className="text-[11px] text-slate-500 mb-3">Elegí un rol: se ingresa con un solo clic. Son cuentas de demostración, no reales.</p>
<div className="grid grid-cols-2 gap-2">
{DEMO_ACCOUNTS.map((acc) => {
const Icon = acc.icon;
return (
<button
key={acc.email}
type="button"
disabled={loadingRole !== null}
onClick={() => loginAs(acc)}
className="flex items-center gap-2 text-xs rounded-xl border border-white/10 px-2.5 py-2 hover:bg-white/10 disabled:opacity-60 text-slate-200 transition-colors text-left"
>
<span className={`flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${acc.tone} text-white shrink-0`}>
<Icon className="w-3.5 h-3.5" />
</span>
<span className="min-w-0">
<span className="block font-medium leading-tight">{loadingRole === acc.role ? "Ingresando..." : ROLE_LABELS[acc.role]}</span>
<span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{acc.hint}</span>
</span>
</button>
);
})}
</div>
</div>
)}
</div>
</div>
);
}

export default function LoginPage() {
return (
<Suspense fallback={null}>
<LoginForm />
</Suspense>
);
}
