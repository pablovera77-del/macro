import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { addAuthorizationAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconUsers, IconUser, IconMapPin, IconClipboard } from "@/components/icons";

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
supabase.from("patients").select("id, nombre_completo, dni, domicilio, obra_social, estado, frecuencia_reposicion").order("nombre_completo"),
supabase.from("products").select("id, descripcion").eq("active", true),
supabase.from("patient_authorizations").select("id, patient_id, cantidad_autorizada, vigente_desde, vigente_hasta, products(descripcion)"),
]);

return (
<div className="space-y-8">
<PageHeader
icon={<IconUsers className="w-5 h-5" />}
title="Autorizaciones de stock"
section="DF-C5 §4, paso 1"
purpose="Acá cargás qué insumos y equipos tiene autorizados cada paciente — eso es lo que le habilita a Depósito armarle el pedido. El alta del paciente y su legajo clínico se hacen desde Internación (Coordinación); esta pantalla solo gestiona sus autorizaciones de stock, no crea pacientes nuevos."
description="Lo que cada paciente tiene autorizado (equipo y descartables) dispara la visibilidad del pedido para Depósito."
/>

<section className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-slide-up">
<span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600 shrink-0">
<IconClipboard className="w-4 h-4" />
</span>
<p className="text-sm text-blue-800">
¿Falta un paciente en la lista? El alta se hace desde <span className="font-medium">Internación</span> (Coordinación de Internación o Médico Coordinador), con el legajo completo. Acá solo aparecen los pacientes ya admitidos, para cargarles autorizaciones de stock.
</p>
</section>

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
<div className="font-medium text-slate-900">{p.nombre_completo} <span className="text-xs font-normal text-slate-400">· DNI {p.dni}</span></div>
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
