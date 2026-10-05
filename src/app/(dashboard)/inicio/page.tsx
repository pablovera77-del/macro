import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { TASKS_BY_ROLE, ROLE_WELCOME } from "@/lib/home-tasks";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { updateVisitStatusAction } from "../agenda/actions";
import { SPECIALTY_LABELS } from "@/lib/auth";
import { IconGrid, IconArrowRight, IconAlert, IconCheck, IconMapPin } from "@/components/icons";
import AlertasCambioMedicacion from "@/components/hc/AlertasCambioMedicacion";

type Pendiente = { label: string; count: number; href: string; urgente?: boolean };

/**
 * "Para hacer hoy": contadores simples y confiables por rol. Cada uno lleva
 * directo a la pantalla donde se resuelve. Si una consulta falla, ese
 * contador se omite (la pantalla de Inicio nunca debe romperse).
 */
async function getPendientes(role: AppRole, userId: string): Promise<Pendiente[]> {
  const supabase = await createClient();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const { count: c, error } = await q;
      return error ? null : c ?? 0;
    } catch {
      return null;
    }
  };
  const out: Pendiente[] = [];
  const push = (label: string, c: number | null, href: string, urgente = false) => {
    if (c && c > 0) out.push({ label, count: c, href, urgente });
  };

  if (role === "coordinador_internacion") {
    push(
      "pacientes admitidos esperan que confirmes su llegada al domicilio",
      await count(supabase.from("patients").select("id", { count: "exact", head: true }).eq("estado", "admitido_pendiente_llegada")),
      "/internacion"
    );
    push(
      "visitas realizadas todavía sin evolución cargada",
      await count(supabase.from("v_visit_evolution_discrepancies").select("*", { count: "exact", head: true })),
      "/evoluciones",
      true
    );
  }
  if (role === "administracion") {
    push(
      "pacientes admitidos esperan que se confirme su llegada al domicilio",
      await count(supabase.from("patients").select("id", { count: "exact", head: true }).eq("estado", "admitido_pendiente_llegada")),
      "/internacion#ingresos"
    );
    push(
      "pedidos esperan tu autorización",
      await count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("estado", "borrador")),
      "/pedidos"
    );
    push(
      "egresos informados esperan que confirmes la baja",
      await count(supabase.from("patients").select("id", { count: "exact", head: true }).not("egreso_informado_at", "is", null).neq("estado", "dado_de_baja")),
      "/pacientes"
    );
    push(
      "autorizaciones por vencer o vencidas",
      await count(supabase.from("v_treatment_authorization_status").select("*", { count: "exact", head: true }).neq("estado_semaforo", "vigente")),
      "/internacion",
      true
    );
  }
  if (role === "deposito") {
    push(
      "pedidos autorizados esperan que los despaches",
      await count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("estado", "autorizado")),
      "/pedidos"
    );
    push(
      "equipos retirados sin confirmar llegada a depósito",
      await count(supabase.from("v_equipos_retirados_sin_confirmar").select("*", { count: "exact", head: true })),
      "/seguimiento",
      true
    );
  }
  if (role === "transporte") {
    push(
      "pedidos despachados esperan entrega",
      await count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("estado", "despachado")),
      "/pedidos"
    );
    push(
      "equipos retirados esperan que confirmes su llegada a depósito",
      await count(supabase.from("v_equipos_retirados_sin_confirmar").select("*", { count: "exact", head: true })),
      "/seguimiento"
    );
  }
  if (role === "profesional_asistencial") {
    push(
      "visitas tuyas programadas o confirmadas",
      await count(supabase.from("visits").select("id", { count: "exact", head: true }).eq("profesional_id", userId).in("estado", ["programada", "confirmada"])),
      "/agenda"
    );
    push(
      "visitas realizadas tuyas todavía sin evolución cargada",
      await count(supabase.from("v_visit_evolution_discrepancies").select("*", { count: "exact", head: true }).eq("profesional_id", userId)),
      "/evoluciones",
      true
    );
  }
  return out;
}


const TZ = "America/Argentina/San_Juan";

// Inicio de día (00:00 en San Juan, UTC-3 sin horario de verano) como instante ISO.
function inicioDeDia(offsetDias: number): string {
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(Date.now() + offsetDias * 86400000));
  return new Date(`${ymd}T00:00:00-03:00`).toISOString();
}

type VisitaDia = {
  id: string;
  especialidad: string;
  fecha_programada: string;
  estado: string;
  patients: { nombre_completo: string; domicilio: string | null; contacto_familiar_nombre: string | null; contacto_familiar_telefono: string | null } | null;
};

/**
 * "Mi día" (C3): para el profesional, las visitas de hoy y mañana (más las atrasadas que
 * siguen sin cerrarse), con domicilio, teléfono del familiar y botones táctiles de estado.
 */
async function MiDia({ userId }: { userId: string }) {
  const supabase = await createClient();
  const hoy = inicioDeDia(0);
  const manana = inicioDeDia(1);
  const pasadoManana = inicioDeDia(2);
  const { data } = await supabase
    .from("visits")
    .select("id, especialidad, fecha_programada, estado, patients(nombre_completo, domicilio, contacto_familiar_nombre, contacto_familiar_telefono)")
    .eq("profesional_id", userId)
    .in("estado", ["programada", "confirmada"])
    .lt("fecha_programada", pasadoManana)
    .order("fecha_programada", { ascending: true });
  const visitas = (data ?? []) as unknown as VisitaDia[];
  const grupos = [
    { titulo: "Atrasadas — cerralas como realizadas o no realizadas", items: visitas.filter((v) => v.fecha_programada < hoy), tone: "rojo" as const },
    { titulo: "Hoy", items: visitas.filter((v) => v.fecha_programada >= hoy && v.fecha_programada < manana), tone: "verde" as const },
    { titulo: "Mañana", items: visitas.filter((v) => v.fecha_programada >= manana), tone: "gris" as const },
  ];
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", timeZone: TZ });

  return (
    <section className="animate-fade-slide-up">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Mi día</h2>
      {visitas.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-sm text-emerald-800">
          <IconCheck className="w-4 h-4" /> No tenés visitas para hoy ni para mañana.
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.filter((g) => g.items.length > 0).map((g) => (
            <div key={g.titulo}>
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge tone={g.tone} label={`${g.items.length}`} />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.titulo}</h3>
              </div>
              <ul className="space-y-3">
                {g.items.map((v) => {
                  const p = v.patients;
                  const tel = p?.contacto_familiar_telefono?.replace(/[^\d+]/g, "");
                  return (
                    <li key={v.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{p?.nombre_completo}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {g.tone === "rojo" ? `${dia(v.fecha_programada)} · ` : ""}{hora(v.fecha_programada)} · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}
                          </div>
                        </div>
                        <StatusBadge tone={v.estado === "confirmada" ? "verde" : "amarillo"} label={v.estado === "confirmada" ? "Confirmada" : "Programada"} className="shrink-0" />
                      </div>
                      {p?.domicilio && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.domicilio)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-sm text-slate-700 hover:underline"
                        >
                          <IconMapPin className="w-4 h-4 text-slate-400 shrink-0" /> {p.domicilio}
                        </a>
                      )}
                      {tel && (
                        <a href={`tel:${tel}`} className="mt-1 block text-sm text-slate-700 hover:underline">
                          Familiar: {p?.contacto_familiar_nombre ?? "contacto"} · {p?.contacto_familiar_telefono}
                        </a>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <form action={updateVisitStatusAction}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <input type="hidden" name="estado" value="realizada" />
                          <button className="w-full min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                            <IconCheck className="w-4 h-4" /> Realizada
                          </button>
                        </form>
                        <form action={updateVisitStatusAction}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <input type="hidden" name="estado" value="no_realizada" />
                          <button className="w-full min-h-11 rounded-xl bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors">No realizada</button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function InicioPage() {
  const { profile } = await requireProfile();
  const tasks = TASKS_BY_ROLE[profile.role];
  const pendientes = await getPendientes(profile.role, profile.id);
  const firstName = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconGrid className="w-5 h-5" />}
        title={`Hola, ${firstName}`}
        badge={ROLE_LABELS[profile.role]}
        purpose={`${ROLE_WELCOME[profile.role]} Elegí abajo qué querés hacer: cada tarjeta te lleva a la pantalla correcta y te explica los pasos.`}
      />

      {profile.role === "profesional_asistencial" && <MiDia userId={profile.id} />}

      <AlertasCambioMedicacion role={profile.role} userId={profile.id} />

      <section className="animate-fade-slide-up">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Para hacer hoy</h2>
        {pendientes.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-sm text-emerald-800">
            <IconCheck className="w-4 h-4" /> No tenés pendientes por ahora.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendientes.map((p) => (
              <li key={p.label}>
                <Link
                  href={p.href}
                  className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
                    p.urgente
                      ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-10 h-10 rounded-xl text-base font-semibold ${
                      p.urgente ? "bg-amber-100 text-amber-700" : "bg-slate-900 text-white"
                    }`}
                  >
                    {p.urgente ? <IconAlert className="w-4 h-4" /> : p.count}
                  </span>
                  <span className="text-sm text-slate-700 flex-1">
                    <strong className="text-slate-900">{p.count}</strong> {p.label}
                  </span>
                  <IconArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="animate-fade-slide-up">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">¿Qué querés hacer?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((t, i) => (
            <article key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col card-hover">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#4CAF50] to-[#0095A8] text-white text-sm font-semibold shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{t.title}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">{t.summary}</p>
                </div>
              </div>
              <details className="mt-3 group">
                <summary className="cursor-pointer select-none text-xs font-medium text-slate-500 hover:text-slate-700 list-none">
                  Cómo se hace ▾
                </summary>
                <ol className="mt-2 space-y-1.5 text-sm text-slate-700 list-decimal pl-5">
                  {t.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {process.env.NEXT_PUBLIC_SHOW_TRACE === "1" && <p className="text-[11px] text-slate-400 mt-2">Relevado en {t.doc}</p>}
              </details>
              <Link
                href={t.href}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 transition-colors w-fit"
              >
                {t.cta} <IconArrowRight className="w-3.5 h-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
