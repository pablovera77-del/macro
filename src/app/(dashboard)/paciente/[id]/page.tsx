import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconUser, IconMapPin, IconCheck, IconAlert } from "@/components/icons";
import { SEMANTIC_TONE_BADGE_STYLES, type SemanticTone } from "@/lib/semantic-status";

const ESTADO_LABELS: Record<string, string> = {
  admitido_pendiente_llegada: "Admitido, pendiente de llegada",
  activo: "Activo",
  dado_de_baja: "Dado de baja",
};
const ESTADO_TONE: Record<string, SemanticTone> = { admitido_pendiente_llegada: "amarillo", activo: "verde", dado_de_baja: "gris" };
const VISITA_LABELS: Record<string, string> = { programada: "Programada", confirmada: "Confirmada", realizada: "Realizada", no_realizada: "No realizada", cancelada: "Cancelada" };
const ORDER_LABELS: Record<string, string> = { borrador: "Esperando autorización", autorizado: "Autorizado", despachado: "Despachado", entregado: "Entregado", cancelado: "No autorizado" };
const SEMAFORO_LABELS: Record<string, string> = { vigente: "Vigente", por_vencer: "Por vencer", vencida: "Vencida" };
const SEMAFORO_TONE: Record<string, SemanticTone> = { vigente: "verde", por_vencer: "amarillo", vencida: "rojo" };

type Tab = "resumen" | "agenda" | "clinica" | "insumos" | "ingreso";

function fecha(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

/**
 * Ficha única del paciente: todo lo del paciente en un solo lugar, con pestañas
 * según el rol. Antes el mismo paciente aparecía en tres pantallas distintas
 * (Pacientes, Autorizaciones de stock, Historia clínica). Los permisos reales
 * siguen en la base de datos (RLS): las pestañas solo ordenan lo que se muestra.
 */
export default async function FichaPacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const { profile } = await requireProfile();
  const role = profile.role;
  if (!["administracion", "coordinador_internacion", "profesional_asistencial"].includes(role)) redirect("/inicio");

  const verClinica = role === "profesional_asistencial" || role === "coordinador_internacion";
  const verInsumos = role === "administracion" || role === "coordinador_internacion";
  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "agenda", label: "Agenda" },
    ...(verClinica ? [{ id: "clinica" as Tab, label: "Historia clínica" }] : []),
    ...(verInsumos ? [{ id: "insumos" as Tab, label: "Insumos y equipos" }] : []),
    { id: "ingreso", label: "Ingreso y egreso" },
  ];
  const tab: Tab = tabs.some((t) => t.id === tabParam) ? (tabParam as Tab) : "resumen";

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("id, nombre_completo, dni, fecha_nacimiento, domicilio, telefono_contacto, contacto_familiar_nombre, contacto_familiar_telefono, diagnostico_principal, obra_social, numero_afiliado, medico_derivante, estado, fecha_ingreso, fecha_egreso, motivo_egreso, llegada_confirmada_at, egreso_informado_at, obras_sociales(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: team }, { data: visits }, { data: auths }, { data: legalDocs }, { data: sigs }] = await Promise.all([
    supabase.from("patient_care_team").select("id, especialidad, profiles(full_name)").eq("patient_id", id),
    supabase.from("visits").select("id, especialidad, fecha_programada, estado, profiles(full_name)").eq("patient_id", id).order("fecha_programada", { ascending: false }).limit(15),
    supabase.from("v_treatment_authorization_status").select("*").eq("patient_id", id).order("periodo_hasta"),
    supabase.from("legal_documents").select("id, titulo").eq("activo", true).order("orden"),
    supabase.from("patient_document_signatures").select("legal_document_id, firmante_nombre, firmado_at").eq("patient_id", id),
  ]);
  const { data: evolutions } = verClinica
    ? await supabase.from("evolutions").select("id, especialidad, created_at, firma_profesional_at, conformidad_familiar, profiles(full_name)").eq("patient_id", id).order("created_at", { ascending: false }).limit(10)
    : { data: null };
  const [{ data: stockAuths }, { data: orders }, { data: equipos }] = verInsumos
    ? await Promise.all([
        supabase.from("patient_authorizations").select("id, cantidad_autorizada, vigente_hasta, products(descripcion)").eq("patient_id", id),
        supabase.from("orders").select("id, estado, created_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(8),
        supabase.from("v_equipos_en_domicilio").select("asset_id, descripcion, numero_serie, desde").eq("patient_id", id),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const obraSocial = (p.obras_sociales as unknown as { nombre: string } | null)?.nombre ?? p.obra_social ?? "Sin obra social";
  const firmados = new Map((sigs ?? []).map((s) => [s.legal_document_id, s]));
  const nombreDe = (x: unknown) => (x as { full_name: string } | null)?.full_name ?? "—";
  const card = "bg-white rounded-2xl border border-slate-200 p-5";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconUser className="w-5 h-5" />}
        title={p.nombre_completo}
        badge={ESTADO_LABELS[p.estado]}
        purpose={`DNI ${p.dni} · ${obraSocial}${p.numero_afiliado ? ` · afiliado ${p.numero_afiliado}` : ""}`}
      />

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Link href="/internacion" className="text-slate-500 hover:text-slate-900 underline underline-offset-2">← Volver a Pacientes</Link>
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${SEMANTIC_TONE_BADGE_STYLES[ESTADO_TONE[p.estado] ?? "gris"]}`}>{ESTADO_LABELS[p.estado]}</span>
      </div>

      <nav aria-label="Secciones de la ficha" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/paciente/${id}?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${t.id === tab ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Datos del paciente</h2>
            <dl className="text-sm space-y-1.5">
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Domicilio</dt><dd className="flex items-start gap-1"><IconMapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400" />{p.domicilio}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Teléfono</dt><dd>{p.telefono_contacto ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Familiar responsable</dt><dd>{p.contacto_familiar_nombre ?? "—"}{p.contacto_familiar_telefono ? ` · ${p.contacto_familiar_telefono}` : ""}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Nacimiento</dt><dd>{fecha(p.fecha_nacimiento)}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Diagnóstico</dt><dd>{p.diagnostico_principal ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Médico derivante</dt><dd>{p.medico_derivante ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-32 shrink-0">Ingreso</dt><dd>{fecha(p.fecha_ingreso)}{p.llegada_confirmada_at ? ` · llegó el ${fecha(p.llegada_confirmada_at)}` : ""}</dd></div>
            </dl>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Equipo asistencial</h2>
            {(team ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Todavía no tiene equipo asignado.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(team ?? []).map((t) => (
                  <li key={t.id}><span className="text-slate-500">{SPECIALTY_LABELS[t.especialidad] ?? t.especialidad}:</span> {nombreDe(t.profiles)}</li>
                ))}
              </ul>
            )}
            <h2 className="text-sm font-semibold text-slate-900 mt-5 mb-3">Próxima visita</h2>
            {(() => {
              const prox = [...(visits ?? [])].filter((v) => v.estado === "programada" || v.estado === "confirmada").sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))[0];
              return prox ? (
                <p className="text-sm">{fecha(prox.fecha_programada)} · {SPECIALTY_LABELS[prox.especialidad] ?? prox.especialidad} · {nombreDe(prox.profiles)}</p>
              ) : (
                <p className="text-sm text-slate-400">No hay visitas programadas.</p>
              );
            })()}
          </section>
        </div>
      )}

      {tab === "agenda" && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Visitas</h2>
          {(visits ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Este paciente todavía no tiene visitas.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(visits ?? []).map((v) => (
                <li key={v.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                  <span>{fecha(v.fecha_programada)} · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad} · {nombreDe(v.profiles)}</span>
                  <span className="text-xs rounded-full bg-slate-100 text-slate-600 px-2.5 py-1">{VISITA_LABELS[v.estado] ?? v.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "clinica" && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Últimas evoluciones</h2>
          {(evolutions ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Sin evoluciones registradas todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(evolutions ?? []).map((e) => (
                <li key={e.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                  <span>{fecha(e.created_at)} · {SPECIALTY_LABELS[e.especialidad] ?? e.especialidad} · {nombreDe(e.profiles)}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-2">
                    {e.firma_profesional_at && <span className="inline-flex items-center gap-0.5 text-emerald-700"><IconCheck className="w-3 h-3" /> Firmada</span>}
                    {e.conformidad_familiar && <span className="text-violet-600">Conformidad familiar</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "insumos" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Insumos autorizados</h2>
            {(stockAuths ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No tiene insumos ni equipos autorizados.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(stockAuths ?? []).map((a) => (
                  <li key={a.id}>{(a.products as unknown as { descripcion: string } | null)?.descripcion ?? "—"} · {a.cantidad_autorizada} <span className="text-xs text-slate-400">(hasta {fecha(a.vigente_hasta)})</span></li>
                ))}
              </ul>
            )}
            <h2 className="text-sm font-semibold text-slate-900 mt-5 mb-3">Equipos en el domicilio</h2>
            {(equipos ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No hay equipos en el domicilio.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(equipos ?? []).map((e) => (
                  <li key={e.asset_id}>{e.descripcion} <span className="text-xs text-slate-400">· serie {e.numero_serie} · desde {fecha(e.desde)}</span></li>
                ))}
              </ul>
            )}
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Pedidos recientes</h2>
            {(orders ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Sin pedidos.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(orders ?? []).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <span>{fecha(o.created_at)}</span>
                    <span className="text-xs rounded-full bg-slate-100 text-slate-600 px-2.5 py-1">{ORDER_LABELS[o.estado] ?? o.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "ingreso" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Consentimientos de ingreso</h2>
            <ul className="text-sm space-y-1.5">
              {(legalDocs ?? []).map((d) => {
                const s = firmados.get(d.id);
                return (
                  <li key={d.id} className="flex items-start gap-2">
                    <span className={s ? "text-emerald-600" : "text-amber-600"}>{s ? "✓" : "○"}</span>
                    <span>{d.titulo}{s && <span className="block text-xs text-slate-400">Firmó {s.firmante_nombre} el {fecha(s.firmado_at)}</span>}</span>
                  </li>
                );
              })}
              {(legalDocs ?? []).length === 0 && <li className="text-slate-400">Sin documentos configurados.</li>}
            </ul>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Prácticas autorizadas por la obra social</h2>
            {(auths ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Sin autorizaciones cargadas.</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {(auths ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SEMANTIC_TONE_BADGE_STYLES[SEMAFORO_TONE[a.estado_semaforo ?? "vigente"] ?? "gris"]}`}>{SEMAFORO_LABELS[a.estado_semaforo ?? "vigente"]}</span>
                    {a.practica} · {a.cantidad_autorizada}x {SPECIALTY_LABELS[a.especialidad ?? ""] ?? a.especialidad} <span className="text-xs text-slate-400">(hasta {fecha(a.periodo_hasta)})</span>
                  </li>
                ))}
              </ul>
            )}
            {p.estado === "dado_de_baja" ? (
              <p className="text-sm text-slate-600 mt-4">Egreso: {p.motivo_egreso ?? "—"} el {fecha(p.fecha_egreso)}.</p>
            ) : p.egreso_informado_at ? (
              <p className="text-sm text-amber-700 mt-4 flex items-center gap-1.5"><IconAlert className="w-4 h-4" /> Egreso informado: falta que Administración confirme la baja.</p>
            ) : null}
          </section>
        </div>
      )}

      <p className="text-xs text-slate-400">Para cargar o modificar datos del ingreso, usá la tarjeta del paciente en <Link href="/internacion" className="underline underline-offset-2">Pacientes</Link>.</p>
    </div>
  );
}
