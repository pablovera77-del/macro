import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import ConfirmButton from "@/components/ConfirmButton";
import ActionDisclosure from "@/components/ActionDisclosure";
import ActionForm from "@/components/stock/ActionForm";
import SubmitButton from "@/components/stock/SubmitButton";
import { IconMapPin } from "@/components/icons";
import { mapaUrl, telUrl, fechaCorta, fechaHora } from "@/lib/stock-ui";
import { horaCorta, PRIORIDAD_LABEL, TIPO_LABEL, type TareaT } from "@/lib/agenda-transporte";
import type { SemanticTone } from "@/lib/semantic-status";
import type { AppRole } from "@/lib/roles";
import {
  iniciarTareaTransporteAction,
  completarTareaTransporteAction,
  reprogramarTareaTransporteAction,
  editarTareaTransporteAction,
  cancelarTareaTransporteAction,
} from "@/app/(dashboard)/agenda-transporte/actions";

const PRIO_TONE: Record<string, SemanticTone> = { alta: "rojo", media: "amarillo", baja: "verde" };
const campo = "w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm";
const btn = "rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2";
const btnSec = "rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-2";

export default function TareaCard({
  t,
  fecha,
  rol,
  hecha,
}: {
  t: TareaT;
  /** Día que se está mirando (para las tareas permanentes). */
  fecha: string;
  rol: AppRole;
  /** Tarea permanente ya hecha en ese día. */
  hecha: boolean;
}) {
  const cerrada = hecha || t.estado === "completada" || t.estado === "cancelada";
  const atrasada = !t.permanente && !cerrada && t.fecha < fecha;
  const mapa = mapaUrl(t.direccion);
  const tel = telUrl(t.telefono);
  const puedeEditar = (rol === "transporte" || rol === "deposito" || rol === "administracion") && !cerrada;
  const borde = cerrada ? "border-slate-200 opacity-75" : t.prioridad === "alta" ? "border-red-300" : t.prioridad === "media" ? "border-amber-300" : "border-emerald-300";

  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${borde}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {horaCorta(t.hora) ? <span className="text-slate-500 font-medium mr-1.5">{horaCorta(t.hora)}</span> : null}
            {t.titulo}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {TIPO_LABEL[t.tipo] ?? t.tipo}
            {t.permanente ? ` · se repite (${t.repeticion})` : ""}
            {t.contacto ? ` · ${t.contacto}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge tone={cerrada ? "gris" : PRIO_TONE[t.prioridad] ?? "gris"} label={PRIORIDAD_LABEL[t.prioridad] ?? t.prioridad} />
          {hecha || t.estado === "completada" ? <StatusBadge tone="verde" label="Hecha" /> : null}
          {t.estado === "cancelada" ? <StatusBadge tone="gris" label="Cancelada" /> : null}
          {!hecha && t.estado === "en_camino" ? <StatusBadge tone="amarillo" label="En camino" /> : null}
          {atrasada ? <StatusBadge tone="rojo" label={`Atrasada (${fechaCorta(t.fecha)})`} /> : null}
        </div>
      </div>

      {t.descripcion && <p className="text-sm text-slate-700 mt-2">{t.descripcion}</p>}
      {(t.direccion || t.telefono) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
          {t.direccion && <span className="text-slate-700">{t.direccion}</span>}
          {mapa && (
            <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <IconMapPin className="w-3.5 h-3.5" /> Abrir en el mapa
            </a>
          )}
          {tel && (
            <a href={tel} className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Llamar {t.telefono}
            </a>
          )}
        </div>
      )}
      {t.reprogramaciones > 0 && t.nota_reprogramacion && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">
          Reprogramada {t.reprogramaciones} {t.reprogramaciones === 1 ? "vez" : "veces"}: {t.nota_reprogramacion}
        </p>
      )}
      {t.iniciada_at && !cerrada && <p className="text-xs text-slate-500 mt-2">Salió {fechaHora(t.iniciada_at)}.</p>}
      {t.completada_at && <p className="text-xs text-slate-500 mt-2">Terminó {fechaHora(t.completada_at)}.</p>}

      {!cerrada && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {t.order_id && (
            <Link href={`/pedidos#pedido-${t.order_id}`} className={btnSec}>Ver el pedido</Link>
          )}
          {rol === "transporte" && t.estado === "pendiente" && (
            <ActionForm action={iniciarTareaTransporteAction}>
              <input type="hidden" name="task_id" value={t.id} />
              <SubmitButton className={btn} pendingLabel="Iniciando…">Salir hacia el domicilio</SubmitButton>
            </ActionForm>
          )}
          {rol === "transporte" && !t.order_id && (
            <ActionForm action={completarTareaTransporteAction}>
              <input type="hidden" name="task_id" value={t.id} />
              <input type="hidden" name="fecha" value={fecha} />
              <SubmitButton className={btn} pendingLabel="Guardando…">Marcar como hecha</SubmitButton>
            </ActionForm>
          )}
          {rol === "transporte" && t.order_id && (
            <span className="text-xs text-slate-500">Se completa al firmar la entrega en Pedidos.</span>
          )}
        </div>
      )}

      {puedeEditar && (
        <div className="flex gap-x-3 flex-wrap">
          <ActionDisclosure label="Cambiar día, hora o prioridad" tone="subtle">
            <ActionForm action={editarTareaTransporteAction} className="grid gap-2 sm:grid-cols-3 max-w-xl">
              <input type="hidden" name="task_id" value={t.id} />
              <label className="text-xs text-slate-600">Día<input type="date" name="fecha" defaultValue={t.fecha} required className={campo} /></label>
              <label className="text-xs text-slate-600">Hora<input type="time" name="hora" defaultValue={horaCorta(t.hora) ?? ""} className={campo} /></label>
              <label className="text-xs text-slate-600">Prioridad
                <select name="prioridad" defaultValue={t.prioridad} className={campo}>
                  <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                </select>
              </label>
              <label className="col-span-full flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="guardar_igual" /> Guardar igual aunque se superponga con otra tarea
              </label>
              <div className="col-span-full"><SubmitButton className={btn}>Guardar cambio</SubmitButton></div>
            </ActionForm>
          </ActionDisclosure>
          {!t.permanente && (
            <ActionDisclosure label="No se pudo hacer hoy" tone="subtle">
              <ActionForm action={reprogramarTareaTransporteAction} className="grid gap-2 max-w-xl">
                <input type="hidden" name="task_id" value={t.id} />
                <label className="text-xs text-slate-600">¿Por qué no se pudo? (queda anotado y pasa al día siguiente)
                  <input name="motivo" required placeholder="Ej.: no había nadie en la casa" className={campo} />
                </label>
                <div><SubmitButton className={btn}>Pasar a mañana</SubmitButton></div>
              </ActionForm>
            </ActionDisclosure>
          )}
          {!t.order_id && (
            <ActionForm action={cancelarTareaTransporteAction} className="mt-3">
              <input type="hidden" name="task_id" value={t.id} />
              <ConfirmButton className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium px-3 py-1.5" confirmLabel="¿Seguro? Tocá de nuevo para cancelar">Cancelar o eliminar tarea</ConfirmButton>
            </ActionForm>
          )}
        </div>
      )}
    </li>
  );
}
