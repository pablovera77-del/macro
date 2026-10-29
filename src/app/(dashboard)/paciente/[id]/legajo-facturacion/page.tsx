import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, SPECIALTY_LABELS } from "@/lib/auth";
import PrintButton from "@/components/hc/PrintButton";
import { fechaCortaAR } from "@/lib/hc";
import { horaAR } from "@/lib/horario";
import { hoyAR, ymdAR } from "@/lib/plan";
import { frecuenciaTexto } from "@/lib/autorizaciones";

/**
 * Legajo de facturación del paciente (DF-C4 §Q12/Q13, a partir de los formularios que se presentan a las obras sociales):
 * reúne por período la identificación (R PFS 02), la admisión (R PFS 03), las autorizaciones, las planillas de atención por
 * disciplina (R PFS 07 médica, 08 enfermería, 10 kinesiología) y los consentimientos firmados. Para DAMSU se pide la ficha
 * de servicio con la conformidad del afiliado en cada atención: se imprime con el formato `?formato=damsu`.
 * Antes de presentar muestra qué falta (autorización sin número, atenciones sin conformidad, consentimientos sin firmar).
 */
const ROLES = ["administracion", "facturacion", "direccion", "coordinador_internacion", "auditor_externo"];
const CODIGO_PLANILLA: Record<string, string> = { medicina: "R PFS 07", enfermeria: "R PFS 08", kinesiologia: "R PFS 10" };
const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

function limitesDelMes(periodo: string) {
  const [y, m] = periodo.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(ultimo).padStart(2, "0")}` };
}

export default async function LegajoFacturacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; formato?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { profile } = await requireProfile();
  if (!ROLES.includes(profile.role)) redirect("/inicio");
  const periodo = sp.periodo && PERIODO.test(sp.periodo) ? sp.periodo : hoyAR().slice(0, 7);
  const damsu = sp.formato === "damsu";
  const { desde, hasta } = limitesDelMes(periodo);

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("id, nombre_completo, nro_historia_clinica, dni, fecha_nacimiento, sexo, ocupacion, localidad, domicilio, domicilio_actual, telefono_actual, telefono_contacto, contacto_familiar_nombre, contacto_familiar_telefono, diagnostico_principal, numero_afiliado, fecha_ingreso, fecha_egreso, es_particular, obra_social, obras_sociales(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: auths }, { data: equipo }, { data: evos }, { data: firmas }, { data: docs }] = await Promise.all([
    supabase
      .from("treatment_authorizations")
      .select("id, practica, codigo_practica, especialidad, frecuencia_cantidad, frecuencia_unidad, frecuencia_periodo, dias_semana, periodo_desde, periodo_hasta, nro_autorizacion, auditor_nombre, vencimiento_documento, documento_archivo")
      .eq("patient_id", id)
      .lte("periodo_desde", hasta)
      .gte("periodo_hasta", desde)
      .order("periodo_desde"),
    supabase.from("patient_care_team").select("especialidad, profiles(full_name)").eq("patient_id", id),
    supabase
      .from("evolutions")
      .select("id, especialidad, created_at, firma_profesional_nombre, firma_profesional_matricula, firma_profesional_at, conformidad_familiar, conformidad_familiar_at, conformidad_nombre, visits(fecha_realizada, fecha_programada, abierta_at)")
      .eq("patient_id", id)
      .gte("created_at", new Date(Date.parse(`${desde}T00:00:00Z`) - 2 * 86400000).toISOString())
      .lte("created_at", new Date(Date.parse(`${hasta}T00:00:00Z`) + 3 * 86400000).toISOString())
      .order("created_at"),
    supabase.from("patient_document_signatures").select("legal_document_id, firmado_at, firmante_nombre").eq("patient_id", id),
    supabase.from("legal_documents").select("id, codigo, titulo").eq("activo", true).order("orden"),
  ]);

  type Visita = { fecha_realizada: string | null; fecha_programada: string; abierta_at: string | null } | null;
  const atenciones = (evos ?? [])
    .map((e) => {
      const v = e.visits as unknown as Visita;
      const cuando = v?.abierta_at ?? v?.fecha_realizada ?? v?.fecha_programada ?? e.created_at;
      return { ...e, cuando, dia: ymdAR(v?.fecha_realizada ?? v?.fecha_programada ?? e.created_at) };
    })
    .filter((e) => e.dia >= desde && e.dia <= hasta)
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.cuando.localeCompare(b.cuando));
  const porDisciplina = new Map<string, typeof atenciones>();
  for (const a of atenciones) porDisciplina.set(a.especialidad, [...(porDisciplina.get(a.especialidad) ?? []), a]);

  const sinConformidad = atenciones.filter((a) => !a.conformidad_familiar).length;
  const sinNumero = (auths ?? []).filter((a) => !a.nro_autorizacion).length;
  const sinDocumento = (auths ?? []).filter((a) => !a.documento_archivo).length;
  const firmadosIds = new Set((firmas ?? []).map((f) => f.legal_document_id));
  const consentimientosFaltan = (docs ?? []).filter((d) => !firmadosIds.has(d.id));
  const obraSocial = (p.obras_sociales as unknown as { nombre: string } | null)?.nombre ?? p.obra_social ?? "Sin obra social";
  const profesionalesPorDisciplina = new Map<string, string[]>();
  for (const t of equipo ?? []) {
    const nombre = (t.profiles as unknown as { full_name: string } | null)?.full_name;
    if (nombre) profesionalesPorDisciplina.set(t.especialidad, [...(profesionalesPorDisciplina.get(t.especialidad) ?? []), nombre]);
  }

  const pendientes = [
    sinNumero > 0 && `${sinNumero} práctica(s) autorizada(s) sin número de autorización (varias obras sociales lo exigen para facturar).`,
    sinDocumento > 0 && `${sinDocumento} práctica(s) sin el documento original adjunto.`,
    (auths ?? []).length === 0 && "No hay autorización vigente en el período.",
    sinConformidad > 0 && `${sinConformidad} atención(es) sin conformidad del paciente o familiar.`,
    consentimientosFaltan.length > 0 && `Consentimientos sin firmar: ${consentimientosFaltan.map((d) => d.titulo).join(", ")}.`,
  ].filter(Boolean) as string[];

  const tab = "text-sm px-3 py-1.5 rounded-lg border";
  const th = "border border-black px-1.5 py-1 text-left font-semibold";
  const td = "border border-black px-1.5 py-1 align-top";
  const [aa, mm] = periodo.split("-");
  const nombreMes = new Date(Date.UTC(Number(aa), Number(mm) - 1, 1)).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  const base = `/paciente/${id}/legajo-facturacion`;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Link href={`/paciente/${id}`} className="text-sm text-slate-600 underline underline-offset-2 mr-2">
          ← Volver a la ficha
        </Link>
        <form className="flex items-center gap-2" action={base}>
          <input type="month" name="periodo" defaultValue={periodo} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Período" />
          {damsu && <input type="hidden" name="formato" value="damsu" />}
          <button className={`${tab} bg-white text-slate-700 border-slate-300`}>Ver período</button>
        </form>
        <Link href={`${base}?periodo=${periodo}`} className={`${tab} ${!damsu ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}>
          Formato general
        </Link>
        <Link href={`${base}?periodo=${periodo}&formato=damsu`} className={`${tab} ${damsu ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}>
          Fichas DAMSU
        </Link>
        <span className="flex-1" />
        <PrintButton />
      </div>

      <section className="no-print rounded-2xl border bg-white border-slate-200 p-4 max-w-3xl mx-auto">
        <h2 className="text-sm font-semibold text-slate-900">Antes de presentar</h2>
        {pendientes.length === 0 ? (
          <p className="text-sm text-emerald-700 mt-1">El legajo del período está completo: autorización con número y documento, atenciones con conformidad y consentimientos firmados.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-amber-800 mt-1 space-y-0.5">
            {pendientes.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
      </section>

      <article className="print-doc bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 text-black max-w-3xl mx-auto space-y-6 text-[13px]">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <div className="text-base font-bold">Profesionales SRL</div>
            <div className="text-xs text-neutral-600">Internación domiciliaria</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">{damsu ? "Fichas de servicio · DAMSU" : "Legajo de facturación"}</div>
            <div className="text-xs text-neutral-600 capitalize">{nombreMes}</div>
          </div>
        </div>

        <section className="space-y-2 break-inside-avoid">
          <h2 className="font-bold text-sm">Identificación del paciente <span className="font-normal text-neutral-600">(R PFS 02)</span></h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div><dt className="text-[11px] text-neutral-600">Apellido y nombre</dt><dd className="font-medium">{p.nombre_completo}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">N.º de historia clínica</dt><dd>{p.nro_historia_clinica ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">DNI</dt><dd>{p.dni}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Fecha de nacimiento · sexo</dt><dd>{p.fecha_nacimiento ? fechaCortaAR(`${p.fecha_nacimiento}T12:00:00Z`) : "—"} · {p.sexo ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Obra social · afiliado</dt><dd>{p.es_particular ? "Particular" : obraSocial}{p.numero_afiliado ? ` · ${p.numero_afiliado}` : ""}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Ocupación</dt><dd>{p.ocupacion ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Domicilio habitual</dt><dd>{p.domicilio}{p.localidad ? ` · ${p.localidad}` : ""}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Domicilio actual</dt><dd>{p.domicilio_actual ?? "El mismo"}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Persona responsable</dt><dd>{p.contacto_familiar_nombre ?? "—"}{p.contacto_familiar_telefono ? ` · ${p.contacto_familiar_telefono}` : ""}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Teléfono</dt><dd>{p.telefono_actual ?? p.telefono_contacto ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="space-y-2 break-inside-avoid">
          <h2 className="font-bold text-sm">Historia clínica / Hoja de admisión <span className="font-normal text-neutral-600">(R PFS 03)</span></h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="col-span-2"><dt className="text-[11px] text-neutral-600">Diagnóstico de base</dt><dd>{p.diagnostico_principal ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Comienzo del servicio</dt><dd>{p.fecha_ingreso ? fechaCortaAR(`${p.fecha_ingreso}T12:00:00Z`) : "—"}</dd></div>
            <div><dt className="text-[11px] text-neutral-600">Finalización del servicio</dt><dd>{p.fecha_egreso ? fechaCortaAR(`${p.fecha_egreso}T12:00:00Z`) : "En curso"}</dd></div>
            {[...profesionalesPorDisciplina.entries()].map(([esp, nombres]) => (
              <div key={esp}><dt className="text-[11px] text-neutral-600">{SPECIALTY_LABELS[esp] ?? esp}</dt><dd>{nombres.join(", ")}</dd></div>
            ))}
          </dl>
        </section>

        <section className="space-y-2 break-inside-avoid">
          <h2 className="font-bold text-sm">Autorizaciones del período</h2>
          {(auths ?? []).length === 0 ? (
            <p className="text-neutral-600">Sin autorización vigente en el período.</p>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead><tr><th className={th}>Práctica</th><th className={th}>Código</th><th className={th}>Frecuencia</th><th className={th}>Período</th><th className={th}>N.º autorización</th></tr></thead>
              <tbody>
                {(auths ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className={td}>{a.practica}</td>
                    <td className={td}>{a.codigo_practica ?? "—"}</td>
                    <td className={td}>{frecuenciaTexto(a) ?? "—"}</td>
                    <td className={td}>{fechaCortaAR(`${a.periodo_desde}T12:00:00Z`)} al {fechaCortaAR(`${a.periodo_hasta}T12:00:00Z`)}</td>
                    <td className={td}>{a.nro_autorizacion ?? "—"}{a.auditor_nombre ? ` (aud. ${a.auditor_nombre})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {porDisciplina.size === 0 ? (
          <section><h2 className="font-bold text-sm">Atenciones del período</h2><p className="text-neutral-600 mt-1">No hay evoluciones firmadas en el período.</p></section>
        ) : (
          [...porDisciplina.entries()].map(([esp, filas]) => {
            const disciplina = SPECIALTY_LABELS[esp] ?? esp;
            const codigo = CODIGO_PLANILLA[esp];
            const titulo = damsu && ["enfermeria", "kinesiologia", "medicina"].includes(esp)
              ? esp === "enfermeria" ? "Ficha de servicio de enfermería" : esp === "kinesiologia" ? "Ficha de sesiones de kinesiología y fisioterapia" : "Ficha de controles médicos"
              : `Planilla de ${disciplina.toLowerCase()}`;
            return (
              <section key={esp} className="space-y-2">
                <h2 className="font-bold text-sm">{titulo} {codigo && !damsu && <span className="font-normal text-neutral-600">({codigo})</span>}</h2>
                {damsu && <p className="text-[12px]">Afiliado: <b>{p.nombre_completo}</b> · DNI {p.dni}</p>}
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className={th}>Fecha</th><th className={th}>Hora</th><th className={th}>Profesional</th>
                      <th className={th}>Conformidad del afiliado o familiar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((a) => (
                      <tr key={a.id} className="break-inside-avoid">
                        <td className={td}>{fechaCortaAR(a.cuando)}</td>
                        <td className={td}>{horaAR(a.cuando)}</td>
                        <td className={td}>{a.firma_profesional_nombre ?? "—"}{a.firma_profesional_matricula ? ` · mat. ${a.firma_profesional_matricula}` : ""}</td>
                        <td className={td}>
                          {a.conformidad_familiar ? <>{a.conformidad_nombre ?? "Conforme"}{a.conformidad_familiar_at ? ` · ${fechaCortaAR(a.conformidad_familiar_at)} ${horaAR(a.conformidad_familiar_at)}` : ""}</> : <span className="text-red-700">Sin conformidad</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-neutral-600">{filas.length} atención(es) en el período. Cada una tiene su evolución completa en la historia clínica.</p>
              </section>
            );
          })
        )}

        <section className="space-y-2 break-inside-avoid">
          <h2 className="font-bold text-sm">Consentimientos <span className="font-normal text-neutral-600">(R PFS 04)</span></h2>
          <ul className="space-y-0.5">
            {(docs ?? []).map((d) => {
              const f = (firmas ?? []).find((x) => x.legal_document_id === d.id);
              return (
                <li key={d.id}>
                  {d.titulo}: {f ? <>firmado{f.firmante_nombre ? ` por ${f.firmante_nombre}` : ""} el {fechaCortaAR(f.firmado_at)}</> : <span className="text-red-700">sin firmar</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-neutral-600">Hoy: {fechaCortaAR(new Date().toISOString())}</p>
        </section>
      </article>
    </div>
  );
}
