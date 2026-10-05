import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
createDischargeAlertAction,
markRetiradoAction,
confirmLlegadaAction,
reportDiscardableReturnAction,
} from "./actions";
import PageHeader from "@/components/PageHeader";
import { IconRefresh, IconAlert, IconMapPin, IconTruck, IconCheck, IconApple } from "@/components/icons";

const MOTIVO_LABELS: Record<string, string> = {
alta: "Alta médica",
fallecimiento: "Fallecimiento",
fin_internacion: "Fin de internación domiciliaria",
};

export default async function SeguimientoPage() {
const { profile } = await requireProfile();
const supabase = await createClient();

const [
{ data: equiposEnDomicilio },
{ data: retiradosSinConfirmar },
{ data: checklistPendiente },
{ data: patientsActivos },
{ data: egresosAbiertos },
{ data: productosRetornables },
] = await Promise.all([
supabase.from("v_equipos_en_domicilio").select("*"),
supabase.from("v_equipos_retirados_sin_confirmar").select("*"),
supabase
.from("retrieval_checklist")
.select(
"id, retirado_at, llego_deposito_at, cantidad, foto_url, discharge_alert_id, equipment_assets(numero_serie, products(descripcion)), products(descripcion), discharge_alerts(patient_id, motivo, patients(nombre_completo))"
)
.is("llego_deposito_at", null),
supabase.from("patients").select("id, nombre_completo").eq("estado", "activo"),
// DF-C5 §4.3: egresos todavía no cerrados — ahí es donde Transporte puede
// reportar la devolución de descartables/alimentos no utilizados.
supabase
.from("discharge_alerts")
.select("id, motivo, patients(nombre_completo)")
.neq("estado", "cerrado")
.order("created_at", { ascending: false }),
supabase.from("products").select("id, descripcion").in("tipo", ["descartable", "alimento"]).eq("active", true).order("descripcion"),
]);

const pendienteRetiro = (checklistPendiente ?? []).filter((c) => !c.retirado_at);
const pendienteConfirmacion = (checklistPendiente ?? []).filter((c) => c.retirado_at);

return (
<div className="space-y-8">
<PageHeader
icon={<IconRefresh className="w-5 h-5" />}
title="Seguimiento de equipos"
section="DF-C5 §4.2"
purpose="Acá sabés dónde está cada equipo serializado. Transporte marca cuándo lo retira del domicilio y cuándo lo deja en depósito; Depósito ve lo que está en camino y controla que no se demore — si pasa mucho tiempo sin confirmar la llegada, se dispara una alerta."
description="Doble check retirado / llegó a depósito — cada movimiento queda en el historial del equipo."
/>

{(retiradosSinConfirmar ?? []).length > 0 && (
<section id="alertas" className="scroll-mt-6 bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-slide-up">
<div className="flex items-center gap-2 mb-3">
<span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600">
<span className="absolute inset-0 rounded-lg animate-pulse-ring" />
<IconAlert className="w-4 h-4" />
</span>
<h2 className="text-sm font-medium text-red-800">Ubicación no confirmada — retirados sin llegar a depósito</h2>
</div>
<ul className="text-sm text-red-700 space-y-1.5">
{[...(retiradosSinConfirmar ?? [])]
.sort((a, b) => (b.vencido_48h ? 1 : 0) - (a.vencido_48h ? 1 : 0))
.map((r) => (
<li key={r.checklist_id} className="flex items-center gap-2">
<span className={`w-1.5 h-1.5 rounded-full ${r.vencido_48h ? "bg-red-600" : "bg-red-400"}`} />
<span className="font-mono text-xs">{r.numero_serie}</span> · {r.descripcion} — retirado el{" "}
{r.retirado_at ? new Date(r.retirado_at).toLocaleString("es-AR") : "—"}
{r.vencido_48h && (
<span className="ml-1 rounded-full bg-red-600 text-white text-[10px] font-medium px-2 py-0.5">+48hs</span>
)}
</li>
))}
</ul>
<p className="text-xs text-red-500 mt-3">
Pasadas 48hs desde la notificación de cierre de la internación sin confirmar la llegada a depósito (la confirma Transporte), el equipo queda marcado “+48hs” — plazo confirmado por Administración.
</p>
</section>
)}

<section id="en-domicilio" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-slide-up card-hover">
<div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
<IconMapPin className="w-4 h-4 text-slate-400" />
<h2 className="text-sm font-medium text-slate-900">Equipos actualmente en domicilios</h2>
</div>
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
<tr>
<th className="text-left px-5 py-2.5 font-medium">N° de serie</th>
<th className="text-left px-5 py-2.5 font-medium">Equipo</th>
<th className="text-left px-5 py-2.5 font-medium">Paciente</th>
<th className="text-left px-5 py-2.5 font-medium">Domicilio</th>
<th className="text-left px-5 py-2.5 font-medium">Desde</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
{(equiposEnDomicilio ?? []).map((e) => (
<tr key={e.asset_id} className="row-hover hover:bg-slate-50">
<td className="px-5 py-2.5 font-mono text-xs text-slate-500">{e.numero_serie}</td>
<td className="px-5 py-2.5 text-slate-900">{e.descripcion}</td>
<td className="px-5 py-2.5 text-slate-600">{e.nombre_completo}</td>
<td className="px-5 py-2.5 text-slate-500 text-xs">{e.domicilio_destino}</td>
<td className="px-5 py-2.5 text-slate-500 text-xs">
{e.desde ? new Date(e.desde).toLocaleDateString("es-AR") : "—"}
</td>
</tr>
))}
{(equiposEnDomicilio ?? []).length === 0 && (
<tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">Sin equipos en domicilios.</td></tr>
)}
</tbody>
</table>
</div>
</section>

{profile.role === "transporte" && pendienteRetiro.length > 0 && (
<section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
<h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
<IconTruck className="w-4 h-4 text-slate-400" /> Pendientes de retirar
</h2>
<div className="space-y-2">
{pendienteRetiro.map((c) => {
const asset = c.equipment_assets as unknown as { numero_serie: string; products: { descripcion: string } | null } | null;
const producto = c.products as unknown as { descripcion: string } | null;
const alert = c.discharge_alerts as unknown as { motivo: string; patients: { nombre_completo: string } | null } | null;
return (
<div key={c.id} className="flex items-center justify-between gap-3 text-sm border border-slate-100 rounded-xl px-3.5 py-2.5 row-hover hover:bg-slate-50 flex-wrap">
<span>
{asset ? `${asset.numero_serie} · ${asset.products?.descripcion}` : `${producto?.descripcion} x${c.cantidad}`} — {alert?.patients?.nombre_completo}{" "}
<span className="text-xs text-slate-400">({MOTIVO_LABELS[alert?.motivo ?? ""] ?? alert?.motivo})</span>
</span>
<form action={markRetiradoAction} className="flex items-center gap-1.5">
<input type="hidden" name="checklist_id" value={c.id} />
<input name="foto_url" placeholder="Foto (URL) — obligatoria" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-48" />
<button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">
Marcar retirado
</button>
</form>
</div>
);
})}
</div>
</section>
)}

{profile.role === "transporte" && egresosAbiertos && egresosAbiertos.length > 0 && (
<section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
<h2 className="text-sm font-medium text-slate-900 mb-1 flex items-center gap-2">
<IconApple className="w-4 h-4 text-slate-400" /> Reportar devolución de descartable/alimento
</h2>
<p className="text-xs text-slate-400 mb-3">
Lo que sobró sin usar en el egreso de un paciente, con foto obligatoria — se acredita al stock cuando Transporte confirma la llegada a depósito.
</p>
<form action={reportDiscardableReturnAction} className="flex flex-wrap gap-2">
<select name="discharge_alert_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[160px]">
<option value="">Egreso del paciente...</option>
{egresosAbiertos.map((e) => (
<option key={e.id} value={e.id}>{(e.patients as unknown as { nombre_completo: string } | null)?.nombre_completo}</option>
))}
</select>
<select name="product_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[160px]">
<option value="">Producto...</option>
{(productosRetornables ?? []).map((p) => (
<option key={p.id} value={p.id}>{p.descripcion}</option>
))}
</select>
<input name="cantidad" type="number" min="1" placeholder="Cantidad" required className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
<input name="foto_url" placeholder="Foto (URL) — obligatoria" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-48" />
<button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Reportar</button>
</form>
</section>
)}

{profile.role === "transporte" && pendienteConfirmacion.length > 0 && (
<section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
<h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
<IconCheck className="w-4 h-4 text-slate-400" /> Retirados: confirmá cuando lleguen a depósito
</h2>
<div className="space-y-2">
{pendienteConfirmacion.map((c) => {
const asset = c.equipment_assets as unknown as { numero_serie: string; products: { descripcion: string } | null } | null;
const producto = c.products as unknown as { descripcion: string } | null;
return (
<div key={c.id} className="flex items-center justify-between gap-3 text-sm border border-slate-100 rounded-xl px-3.5 py-2.5 row-hover hover:bg-slate-50">
<span>{asset ? `${asset.numero_serie} · ${asset.products?.descripcion}` : `${producto?.descripcion} x${c.cantidad} (devolución)`}</span>
<form action={confirmLlegadaAction}>
<input type="hidden" name="checklist_id" value={c.id} />
<button className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors">
Confirmar llegada a depósito
</button>
</form>
</div>
);
})}
</div>
</section>
)}

{profile.role === "deposito" && pendienteConfirmacion.length > 0 && (
<section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
<h2 className="text-sm font-medium text-slate-900 mb-1 flex items-center gap-2">
<IconTruck className="w-4 h-4 text-slate-400" /> En camino a depósito
</h2>
<p className="text-xs text-slate-500 mb-3">Ya los retiró Transporte. Cuando lleguen, Transporte confirma la llegada y vuelven a quedar disponibles.</p>
<div className="space-y-2">
{pendienteConfirmacion.map((c) => {
const asset = c.equipment_assets as unknown as { numero_serie: string; products: { descripcion: string } | null } | null;
const producto = c.products as unknown as { descripcion: string } | null;
return (
<div key={c.id} className="text-sm border border-slate-100 rounded-xl px-3.5 py-2.5">
{asset ? `${asset.numero_serie} · ${asset.products?.descripcion}` : `${producto?.descripcion} x${c.cantidad} (devolución)`}
</div>
);
})}
</div>
</section>
)}

{profile.role === "administracion" && (
<section className="bg-white rounded-2xl border border-slate-200 p-5 animate-fade-slide-up card-hover">
<h2 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
<IconAlert className="w-4 h-4 text-slate-400" /> Generar egreso de paciente
</h2>
<form action={createDischargeAlertAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<select name="patient_id" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
<option value="">Paciente...</option>
{(patientsActivos ?? []).map((p) => (
<option key={p.id} value={p.id}>{p.nombre_completo}</option>
))}
</select>
<select name="motivo" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
<option value="">Motivo...</option>
<option value="alta">Alta médica</option>
<option value="fallecimiento">Fallecimiento</option>
<option value="fin_internacion">Fin de internación domiciliaria</option>
</select>
<button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors">
Generar alerta a Depósito
</button>
</form>
</section>
)}
</div>
);
}
