import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createObraSocialAction, addValueHistoryAction, assignResponsableAction, addRequiredDocAction, removeRequiredDocAction } from "./actions";
import PageHeader from "@/components/PageHeader";
import SidePanel from "@/components/SidePanel";
import ActionDisclosure from "@/components/ActionDisclosure";
import { IconBuilding } from "@/components/icons";
import ConfigObraSocialForm from "@/components/facturacion/ConfigObraSocialForm";
import { MODALIDAD_LABELS } from "@/lib/facturacion";

function formatARS(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export default async function ObrasSocialesPage() {
  const { profile } = await requireProfile();
  // Datos económicos: solo Administración (que los gestiona) y Dirección (solo lectura).
  if (profile.role !== "administracion" && profile.role !== "direccion" && profile.role !== "facturacion") redirect("/inicio");
  const supabase = await createClient();

  const [{ data: obrasSociales }, { data: history }, { data: patientCounts }, { data: responsables }, { data: docsReq }] = await Promise.all([
    supabase
      .from("obras_sociales")
      .select("id, nombre, cuit, dias_para_facturar, valor_modulo, activa, responsable_id, reglas_facturacion, modalidad_facturacion, auditoria_contacto_nombre, auditoria_contacto_telefono, auditoria_contacto_email, profiles:responsable_id(full_name)")
      .order("nombre"),
    supabase.from("obra_social_value_history").select("id, obra_social_id, valor, vigente_desde").order("vigente_desde", { ascending: false }),
    supabase.from("patients").select("obra_social_id").eq("estado", "activo"),
    // DF-C3 §2: cada una de las 3 personas de Administración es responsable de
    // un grupo de obras sociales — este select arma el combo para asignarlas.
    supabase.from("profiles").select("id, full_name").eq("role", "administracion").eq("active", true).order("full_name"),
    supabase.from("os_required_documents").select("id, obra_social_id, nombre, obligatorio").eq("activo", true).order("orden"),
  ]);

  const canManage = profile.role === "administracion";
  const canBill = profile.role === "facturacion";
  const countByOs = new Map<string, number>();
  (patientCounts ?? []).forEach((p) => {
    if (p.obra_social_id) countByOs.set(p.obra_social_id, (countByOs.get(p.obra_social_id) ?? 0) + 1);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        action={canManage ? { label: "+ Nueva obra social", href: "#nueva-obra-social" } : undefined}
        icon={<IconBuilding className="w-5 h-5" />}
        title="Obras sociales"
        section="DF-C1 §3 · DF-C4 §2/§3"
        purpose="Acá mantenés al día el valor del módulo de cada obra social. Cuando cambia, actualizalo acá en vez de pisarlo — así Facturación nunca pierde de vista con qué valor se facturó cada período."
        description="Catálogo con plazo de facturación e histórico de valores por módulo."
      />

      <section className="space-y-3">
        {(obrasSociales ?? []).map((os, i) => {
          const hist = (history ?? []).filter((h) => h.obra_social_id === os.id).slice(0, 5);
          return (
            <div key={os.id} className={`bg-white rounded-2xl border border-slate-200 p-5 card-hover animate-fade-slide-up stagger-${Math.min(i + 1, 8)}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium text-slate-900">{os.nombre}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {os.cuit ? `CUIT ${os.cuit} · ` : ""}Plazo de facturación: {os.dias_para_facturar} días · {countByOs.get(os.id) ?? 0} pacientes activos
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Responsable: {(os.profiles as unknown as { full_name: string } | null)?.full_name ?? "sin asignar"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{formatARS(os.valor_modulo)}</div>
                  <div className="text-[11px] text-slate-400">valor de módulo vigente</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div>
                  <span className="font-medium text-slate-700">Modalidad:</span>{" "}
                  {os.modalidad_facturacion ? MODALIDAD_LABELS[os.modalidad_facturacion] : "sin definir"}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Reglas de facturación:</span> {os.reglas_facturacion || "sin cargar"}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Contacto de auditoría:</span>{" "}
                  {[os.auditoria_contacto_nombre, os.auditoria_contacto_telefono, os.auditoria_contacto_email].filter(Boolean).join(" · ") || "sin cargar"}
                </div>
              </div>

              {hist.length > 0 && (
                <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-1.5">
                  {hist.map((h) => (
                    <span key={h.id} className="bg-slate-50 rounded-full px-2.5 py-1">
                      {formatARS(h.valor)} desde {h.vigente_desde}
                    </span>
                  ))}
                </div>
              )}

              {canBill && (
                <ActionDisclosure label="Configurar reglas y contacto" tone="subtle">
                  <ConfigObraSocialForm
                    obraSocialId={os.id}
                    reglas={os.reglas_facturacion}
                    modalidad={os.modalidad_facturacion}
                    dias={os.dias_para_facturar}
                    contactoNombre={os.auditoria_contacto_nombre}
                    contactoTelefono={os.auditoria_contacto_telefono}
                    contactoEmail={os.auditoria_contacto_email}
                  />
                </ActionDisclosure>
              )}

              {canBill && (
                <ActionDisclosure label="Actualizar valor" tone="subtle">
                  <form action={addValueHistoryAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="obra_social_id" value={os.id} />
                    <input name="valor" type="number" step="0.01" placeholder="Nuevo valor" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-32" />
                    <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Actualizar</button>
                  </form>
                </ActionDisclosure>
              )}

              {(() => {
                const docs = (docsReq ?? []).filter((d) => d.obra_social_id === os.id);
                return (
                  <div className="mt-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Documentación requerida al ingreso:</span>{" "}
                    {docs.length === 0 ? "todavía no configurada" : (
                      <span className="inline-flex flex-wrap gap-1.5 align-middle">
                        {docs.map((d) => (
                          <span key={d.id} className="bg-slate-50 rounded-full pl-2.5 pr-1.5 py-1 inline-flex items-center gap-1">
                            {d.nombre}{!d.obligatorio && " (opcional)"}
                            {profile.role === "administracion" && (
                              <form action={removeRequiredDocAction} className="inline">
                                <input type="hidden" name="id" value={d.id} />
                                <button aria-label={`Quitar ${d.nombre}`} className="text-slate-400 hover:text-red-600 px-1">×</button>
                              </form>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })()}

              {profile.role === "administracion" && (
                <ActionDisclosure label="Agregar documento requerido" tone="subtle">
                  <form action={addRequiredDocAction} className="flex flex-wrap gap-2 items-center">
                    <input type="hidden" name="obra_social_id" value={os.id} />
                    <input name="nombre" required placeholder="Ej. Orden médica con sello" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[200px]" />
                    <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" name="obligatorio" defaultChecked className="rounded border-slate-300" /> Obligatorio</label>
                    <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Agregar</button>
                  </form>
                </ActionDisclosure>
              )}

              {canManage && (
                <ActionDisclosure label="Asignar responsable" tone="subtle">
                  <form action={assignResponsableAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="obra_social_id" value={os.id} />
                    <select name="responsable_id" defaultValue={os.responsable_id ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[180px]">
                      <option value="">Sin asignar</option>
                      {(responsables ?? []).map((r) => (
                        <option key={r.id} value={r.id}>{r.full_name}</option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors">Guardar</button>
                  </form>
                </ActionDisclosure>
              )}
            </div>
          );
        })}
      </section>

      {canManage && (
        <SidePanel id="nueva-obra-social" title="Nueva obra social">
          <form action={createObraSocialAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input name="nombre" placeholder="Nombre" required className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <input name="cuit" placeholder="CUIT (opcional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="dias_para_facturar" type="number" defaultValue="10" placeholder="Días para facturar" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input name="valor_modulo" type="number" step="0.01" placeholder="Valor inicial de módulo" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2" />
            <button className="rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors sm:col-span-2">
              Crear
            </button>
          </form>
        </SidePanel>
      )}
    </div>
  );
}
