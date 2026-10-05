import StatusBadge from "@/components/StatusBadge";
import {
  asMedicacion,
  asNova5,
  asRespuestas,
  fechaHoraAR,
  NOVA5_DIMENSIONES,
  resolverRespuestas,
  RIESGO_TONE,
  type Campo,
} from "@/lib/hc";
import type { Json } from "@/types/database";

/** Datos de una evolución que este componente sabe mostrar. */
export type EvolucionVista = {
  respuestas: Json;
  upp_escala_nova5: Json | null;
  medicacion: Json | null;
  alerta_cambio: boolean;
  alerta_motivo: string | null;
  firma_profesional_at: string | null;
  firma_profesional_img: string | null;
  firma_profesional_nombre: string | null;
  firma_profesional_matricula: string | null;
  conformidad_familiar: boolean | null;
  conformidad_familiar_at: string | null;
  conformidad_nombre: string | null;
  conformidad_firma: string | null;
};

/**
 * Muestra el contenido de una evolución: respuestas por sección, escala Nova 5,
 * medicación y firmas. Lo usan el historial, la ficha del paciente y la vista de
 * impresión (`modo="os"` omite la narrativa extendida).
 */
export default function EvolucionDetalle({
  e,
  campos,
  modo = "completo",
  profesionalNombre,
  imprimible = false,
}: {
  e: EvolucionVista;
  campos: Campo[];
  modo?: "completo" | "os";
  /** Nombre del profesional si la evolución no guardó el de la firma (evoluciones anteriores). */
  profesionalNombre?: string | null;
  /** En la vista de impresión los textos van en negro y sin fondos de color. */
  imprimible?: boolean;
}) {
  const secciones = resolverRespuestas(asRespuestas(e.respuestas), campos, modo);
  const nova = asNova5(e.upp_escala_nova5);
  const meds = asMedicacion(e.medicacion);
  const titulo = imprimible ? "text-xs font-bold uppercase tracking-wide text-black mb-1.5" : "text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5";
  const labelCls = imprimible ? "text-[11px] text-neutral-600" : "text-[11px] text-slate-500";
  const valueCls = imprimible ? "text-sm text-black whitespace-pre-line" : "text-sm text-slate-900 whitespace-pre-line";
  const box = imprimible ? "border border-neutral-400 rounded-md p-3" : "rounded-xl bg-slate-50 p-3";

  return (
    <div className="space-y-4">
      {e.alerta_cambio && (
        <div className={imprimible ? "border border-black rounded-md p-3 text-sm text-black" : "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"}>
          <span className="font-semibold">Cambio relevante en la medicación o la indicación.</span>
          {e.alerta_motivo ? ` ${e.alerta_motivo}` : ""}
        </div>
      )}

      {secciones.length === 0 && <p className={labelCls}>Esta evolución no tiene respuestas cargadas.</p>}
      {secciones.map((s, i) => (
        <section key={`${s.titulo ?? "general"}-${i}`}>
          {s.titulo && <h4 className={titulo}>{s.titulo}</h4>}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            {s.items.map((it) => (
              <div key={it.label} className={it.largo || it.value.length > 40 ? "col-span-2 sm:col-span-4" : ""}>
                <dt className={labelCls}>{it.label}</dt>
                <dd className={valueCls}>{it.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {meds.length > 0 && (
        <section>
          <h4 className={titulo}>Medicación</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[460px]">
              <thead>
                <tr className={`text-left ${labelCls}`}>
                  <th className="font-medium pr-3 py-1">Cantidad</th>
                  <th className="font-medium pr-3 py-1">Droga</th>
                  <th className="font-medium pr-3 py-1">Nombre comercial</th>
                  <th className="font-medium pr-3 py-1">Dosis</th>
                  <th className="font-medium py-1">Frecuencia</th>
                </tr>
              </thead>
              <tbody className={imprimible ? "text-black" : "text-slate-900"}>
                {meds.map((m, i) => (
                  <tr key={i} className={imprimible ? "border-t border-neutral-300" : "border-t border-slate-100"}>
                    <td className="pr-3 py-1">{m.cantidad || "—"}</td>
                    <td className="pr-3 py-1">{m.droga}</td>
                    <td className="pr-3 py-1">{m.nombre_comercial || "—"}</td>
                    <td className="pr-3 py-1">{m.dosis || "—"}</td>
                    <td className="py-1">{m.frecuencia || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {nova && (
        <section className={box}>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className={titulo + " !mb-0"}>Escala Nova 5 · riesgo de úlceras por presión</h4>
            {imprimible ? (
              <span className="text-sm font-semibold text-black">Total {nova.total}: riesgo {nova.riesgo}</span>
            ) : (
              <StatusBadge tone={RIESGO_TONE[nova.riesgo] ?? "gris"} label={`Riesgo ${nova.riesgo} · Nova 5 = ${nova.total}`} />
            )}
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {NOVA5_DIMENSIONES.map((d) => {
              const v = nova[d.key];
              return (
                <div key={d.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className={labelCls}>{d.label}</dt>
                  <dd className={imprimible ? "text-black" : "text-slate-900"}>
                    {d.niveles[v] ?? "—"} <span className={labelCls}>({v})</span>
                  </dd>
                </div>
              );
            })}
          </dl>
          {nova.movilizacion_indicada && (
            <p className={`${labelCls} mt-2`}>Se le indicaron a la familia las pautas de movilización.</p>
          )}
        </section>
      )}

      <section className={`grid grid-cols-1 sm:grid-cols-2 gap-3`}>
        <FirmaBloque
          titulo="Firma del profesional"
          img={e.firma_profesional_img}
          nombre={e.firma_profesional_nombre ?? profesionalNombre ?? null}
          detalle={e.firma_profesional_matricula ? `Matrícula ${e.firma_profesional_matricula}` : null}
          fecha={e.firma_profesional_at}
          firmada={!!e.firma_profesional_at}
          faltaTxt="Sin firma del profesional"
          imprimible={imprimible}
        />
        <FirmaBloque
          titulo="Conformidad del paciente o familiar"
          img={e.conformidad_firma}
          nombre={e.conformidad_nombre}
          detalle={null}
          fecha={e.conformidad_familiar_at}
          firmada={!!e.conformidad_familiar}
          faltaTxt="Sin conformidad de la familia"
          imprimible={imprimible}
        />
      </section>
    </div>
  );
}

function FirmaBloque({
  titulo,
  img,
  nombre,
  detalle,
  fecha,
  firmada,
  faltaTxt,
  imprimible,
}: {
  titulo: string;
  img: string | null;
  nombre: string | null;
  detalle: string | null;
  fecha: string | null;
  firmada: boolean;
  faltaTxt: string;
  imprimible: boolean;
}) {
  const wrap = imprimible ? "border border-neutral-400 rounded-md p-3 break-inside-avoid" : "rounded-xl border border-slate-200 p-3";
  const label = imprimible ? "text-[11px] text-neutral-600" : "text-[11px] text-slate-500";
  return (
    <div className={wrap}>
      <div className={`${label} mb-1`}>{titulo}</div>
      {firmada ? (
        <>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={`${titulo}${nombre ? `: ${nombre}` : ""}`} className="h-20 w-auto max-w-full object-contain" />
          ) : (
            <div className={`${label} italic`}>Firmada en el sistema (sin trazo guardado)</div>
          )}
          {(nombre || detalle) && (
            <div className={imprimible ? "text-sm text-black mt-1" : "text-sm text-slate-900 mt-1"}>
              {nombre}
              {detalle && <span className={label}> · {detalle}</span>}
            </div>
          )}
          <div className={label}>{fechaHoraAR(fecha)}</div>
        </>
      ) : imprimible ? (
        <div className="text-sm text-black">{faltaTxt}</div>
      ) : (
        <StatusBadge tone="amarillo" label={faltaTxt} />
      )}
    </div>
  );
}
