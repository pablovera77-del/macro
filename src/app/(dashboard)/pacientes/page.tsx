import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { addAuthorizationAction, confirmarEgresoAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconUsers, IconUser, IconMapPin, IconClipboard, IconAlert } from "@/components/icons";

const MOTIVO_EGRESO_LABELS: Record<string, string> = {
alta: "Alta médica",
fallecimiento: "Fallecimiento",
fin_internacion: "Fin de internación",
};

const ESTADO_LABELS: Record<string, string> = {
admitido_pendiente_llegada: "Admitido, pendiente de llegada",
activo: "Activo",
dado_de_baja: "Dado de baja",
};
const ESTADO_STYLES: Record<string, string> = {
admitido_pendiente_llegada: "bg-amber-100 text-amber-700",
activo: "bg-emerald-100 text-emerald-700",
dado_de_baja: "bg-slate-200 text-slate-600",
};
const FRECUENCIA_LABELS: Record<string, string> = {
mensualizado: "Mensualizado",
semanal: "Semanal",
quincenal: "Quincenal",
a_demanda: "A demanda",
};

export default async function PacientesPage() {
const { profile } = await requireProfile();
const supabase = await createClient();

const [{ data: patients }, { data: products }, { data: authorizations }] = await Promise.all([
supabase
.from("patients")
.select(
"id, nombre_completo, dni, domicilio, obra_social, estado, frecuencia_reposicion, egreso_informado_at, egreso_motivo_informado, profiles:egreso_informado_por(full_name)"
)
.order("nombre_completo"),
supabase.from("products").select("id, descripcion").eq("active", true),
supabase.from("patient_authorizations").select("id, patient_id, cantidad_autorizada, vigente_desde, vigente_hasta, products(descripcion)"),
]);

const canConfirmEgreso = profile.role === "administracion";
const egresosPendientes = (patients ?? []).filter((p) => p.egreso_informado_at && p.estado !== "dado_de_baja");

return (
<div className="space-y-8">
<PageHeader
icon={<IconUsers className="w-5 h-5" />}
title="Autorizaciones de stock"
section="DF-C5 §4, paso 1"
purpose="Cargá qué insumos y equipos tiene autorizados cada paciente: eso habilita a Depósito a armarle el pedido."
description="Lo que cada paciente tiene autorizado (equipo y descartables) dispara la visibilidad del pedido para Depósito."
/>

<section className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-slide-up">
<span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600 shrink-0">
<IconClipboard className="w-4 h-4" />
</span>
<p className="text-sm text-blue-800">
¿Falta un paciente en la lista? El alta se hace en <span className="font-medium">Pacientes</span> con el botón «+ Nuevo paciente». Acá solo aparecen los pacientes ya admitidos, para cargarles autorizaciones de stock.
</p>
</section>

{canConfirmEgreso && egresosPendientes.length > 0 && (
<section className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
<div className="flex items-center gap-2 mb-3">
<span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
<IconAlert className="w-4 h-4" />
</span>
<h2 className="text-sm font-medium text-red-800">Egresos informados: falta confirmar la baja</h2>
</div>
<div className="space-y-2">
{egresosPendientes.map((p) => (
<div key={p.id} className="flex items-center justify-between gap-3 text-sm border border-red-100 bg-white rounded-xl px-3.5 py-2.5 flex-wrap">
<span>
{p.nombre_completo}{" "}
<span className="text-xs text-slate-400">
— {MOTIVO_EGRESO_LABELS[p.egreso_motivo_informado ?? ""] ?? p.egreso_motivo_informado}, informado por{" "}
{(p.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
</span>
</span>
<form action={confirmarEgresoAction}>
<input type="hidden" name="patient_id" value={p.id} />
<ConfirmButton className="rounded-lg bg-red-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-red-700 transition-colors" confirmLabel="¿Baja definitiva? Tocá de nuevo">
Confirmar baja definitiva
</ConfirmButton>
</form>
</div>
))}
</div>
<p className="text-xs text-red-500 mt-3">
El profesional o Coordinación solo informa el egreso — es Administración quien confirma la baja definitiva, y eso dispara la alerta de retiro de equipos para Transporte y Depósito.
</p>
</section>
)}

<section className="space-y-3">
{(patients ?? []).map((p, i) => {
const auths = (authorizations ?? []).filter((a) => a.patient_id === p.id);
const initials = p.nombre_completo.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
return (
<div key={p.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}>
<div className="flex items-start justify-between gap-4 flex-wrap">
<div className="flex items-start gap-3">
<span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white text-xs font-semibold shrink-0">
{initials || <IconUser className="w-4 h-4" />}
</span>
<div>
<div className="font-medium text-slate-900"><Link href={`/paciente/${p.id}`} className="hover:underline underline-offset-2">{p.nombre_completo}</Link> <span className="text-xs font-normal text-slate-400">· DNI {p.dni}</span></div>
<div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
<IconMapPin className="w-3 h-3" /> {p.domicilio} · {p.obra_social ?? "sin obra social"}
</div>
</div>
</div>
<div className="flex items-center gap-2">
<span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[p.estado]}`}>
{ESTADO_LABELS[p.estado]}
</span>
<span className="text-xs text-slate-400 bg-slate-50 rounded-full px-2.5 py-1">{FRECUENCIA_LABELS[p.frecuencia_reposicion]}</span>
</div>
</div>

<ul className="text-sm text-slate-600 mt-3 space-y-1 pl-1">
{auths.map((a) => (
<li key={a.id} className="flex items-center gap-2">
<span className="w-1 h-1 rounded-full bg-slate-300" />
{a.cantidad_autorizada}x {(a.products as unknown as { descripcion: string } | null)?.descripcion}
{a.vigente_hasta && <span className="text-xs text-slate-400">(hasta {a.vigente_hasta})</span>}
</li>
))}
{auths.length === 0 && <li className="text-slate-400 text-xs">Sin autorizaciones cargadas.</li>}
</ul>

{profile.role === "administracion" && (
<ActionDisclosure label="Cargar autorización" tone="subtle">
<form action={addAuthorizationAction} className="flex flex-wrap gap-2">
<input type="hidden" name="patient_id" value={p.id} />
<select name="product_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
<option value="">Producto...</option>
{(products ?? []).map((prod) => (
<option key={prod.id} value={prod.id}>{prod.descripcion}</option>
))}
</select>
<input name="cantidad_autorizada" type="number" min="1" defaultValue="1" className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
<input name="vigente_hasta" type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
<button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
Cargar
</button>
</form>
</ActionDisclosure>
)}
</div>
);
})}
</section>

</div>
);
}
