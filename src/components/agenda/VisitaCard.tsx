import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import StatusBadge from "@/components/StatusBadge";
import IniciarVisitaButton from "@/components/agenda/IniciarVisitaButton";
import ReprogramarForm, { type MotivoReprogramacion } from "@/components/agenda/ReprogramarForm";
import { IconCheck, IconMapPin } from "@/components/icons";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { updateVisitStatusAction, cancelVisitAction } from "@/app/(dashboard)/agenda/actions";
import { descripcionHorario, horaAR } from "@/lib/horario";
import { telHref, urlMapa } from "@/lib/mapa";
import type { VisitaAgenda } from "@/lib/agenda-tipos";

const ESTADO_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  no_realizada: "No realizada",
  cancelada: "Cancelada",
};
const ESTADO_TONO = { programada: "gris", confirmada: "verde", realizada: "verde", no_realizada: "rojo", cancelada: "gris" } as const;

const btn = "w-full min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors px-3";

/**
 * Tarjeta de una visita en la agenda. El profesional ve los botones de su visita (iniciar, confirmar,
 * realizada, no realizada); Coordinación ve cambiar día/horario y cancelar. Todos ven el domicilio
 * con «Abrir en Google Maps» y los teléfonos de contacto con botón de llamar.
 */
export default function VisitaCard({
  v,
  rol,
  atrasada,
  conflicto,
  mostrarProfesional,
  motivos = [],
}: {
  v: VisitaAgenda;
  rol: string;
  atrasada: boolean;
  conflicto: boolean;
  mostrarProfesional: boolean;
  motivos?: MotivoReprogramacion[];
}) {
  const p = v.patients;
  const esProfesional = rol === "profesional_asistencial";
  const esCoordinador = rol === "coordinador_internacion";
  const abierta = (v.estado === "programada" || v.estado === "confirmada") && !!v.abierta_at;
  const telPaciente = telHref(p?.telefono_contacto);
  const telFamiliar = telHref(p?.contacto_familiar_telefono);
  const estado = v.estado as keyof typeof ESTADO_TONO;

  return (
    <div className={`bg-white rounded-2xl border p-4 sm:p-5 ${atrasada ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/paciente/${v.patient_id}`} className="font-medium text-slate-900 hover:underline underline-offset-2">
            {p?.nombre_completo}
          </Link>
          <div className="text-sm text-slate-700 mt-0.5">
            <span className="font-medium">{descripcionHorario(v)}</span> · {SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}
            {mostrarProfesional && v.profiles?.full_name ? <> · {v.profiles.full_name}</> : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
          {abierta && <StatusBadge tone="amarillo" label={`En curso desde las ${horaAR(v.abierta_at as string)}`} />}
          <StatusBadge tone={ESTADO_TONO[estado] ?? "gris"} label={ESTADO_LABELS[v.estado] ?? v.estado} />
          {atrasada && <StatusBadge tone="rojo" label="Atrasada" />}
          {conflicto && <StatusBadge tone="amarillo" label="Misma hora que otra visita" />}
        </div>
      </div>

      {p?.domicilio && (
        <div className="mt-2 flex items-start gap-2 text-sm text-slate-700">
          <IconMapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1">{p.domicilio}</span>
          <a href={urlMapa(p.domicilio)} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-50">
            Abrir en Google Maps
          </a>
        </div>
      )}

      {(telPaciente || telFamiliar) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {telPaciente && (
            <a href={telPaciente} className="rounded-lg bg-slate-100 text-slate-800 text-xs font-medium px-3 py-1.5 hover:bg-slate-200">
              Llamar al paciente · {p?.telefono_contacto}
            </a>
          )}
          {telFamiliar && (
            <a href={telFamiliar} className="rounded-lg bg-slate-100 text-slate-800 text-xs font-medium px-3 py-1.5 hover:bg-slate-200">
              Llamar a {p?.contacto_familiar_nombre ?? "familiar"} · {p?.contacto_familiar_telefono}
            </a>
          )}
        </div>
      )}

      {v.observacion_agenda && <div className="text-xs text-slate-500 mt-2">{v.observacion_agenda}</div>}

      {esProfesional && (v.estado === "programada" || v.estado === "confirmada") && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!v.abierta_at && <IniciarVisitaButton visitId={v.id} className={`${btn} bg-slate-900 text-white hover:bg-slate-800 col-span-2 disabled:opacity-60`} />}
          {v.estado === "programada" && (
            <form action={updateVisitStatusAction} className="col-span-2">
              <input type="hidden" name="visit_id" value={v.id} />
              <input type="hidden" name="estado" value="confirmada" />
              <button className={`${btn} bg-violet-600 text-white hover:bg-violet-700`}>Confirmar</button>
            </form>
          )}
          <form action={updateVisitStatusAction}>
            <input type="hidden" name="visit_id" value={v.id} />
            <input type="hidden" name="estado" value="realizada" />
            <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
              <IconCheck className="w-4 h-4" /> Realizada
            </button>
          </form>
          <form action={updateVisitStatusAction}>
            <input type="hidden" name="visit_id" value={v.id} />
            <input type="hidden" name="estado" value="no_realizada" />
            <ConfirmButton className={`${btn} bg-red-100 text-red-700 hover:bg-red-200`} confirmLabel="¿No se hizo? Tocá de nuevo">
              No realizada
            </ConfirmButton>
          </form>
        </div>
      )}

      {esCoordinador && (v.estado === "programada" || v.estado === "confirmada") && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <ReprogramarForm visitId={v.id} motivos={motivos} />
          <form action={cancelVisitAction}>
            <input type="hidden" name="visit_id" value={v.id} />
            <ConfirmButton className="rounded-lg bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1.5 hover:bg-slate-200 transition-colors" confirmLabel="¿Cancelar? Tocá de nuevo">
              Cancelar
            </ConfirmButton>
          </form>
        </div>
      )}
    </div>
  );
}
