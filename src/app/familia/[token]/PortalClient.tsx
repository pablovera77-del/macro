"use client";

import { useState, useTransition } from "react";
import { portalVerAction, portalConfirmarAction, type PortalData, type PortalVisita } from "../actions";
import { PORTAL_ERRORES } from "@/lib/family";
import { SPECIALTY_LABELS } from "@/lib/roles";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";

const TZ = "America/Argentina/San_Juan";
const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });

const ESTADOS_PROXIMAS: Record<string, string> = { programada: "Programada", confirmada: "Confirmada" };

export default function PortalClient({ token, habilitado }: { token: string; habilitado: boolean }) {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await portalVerAction(token, pin);
      if (r.ok) setData(r);
      else setError(PORTAL_ERRORES[r.error ?? "invalido"] ?? PORTAL_ERRORES.invalido);
    });
  }

  function confirmar(v: PortalVisita) {
    setError(null);
    start(async () => {
      const r = await portalConfirmarAction(token, pin, v.id, nombre);
      if (!r.ok) {
        setError(PORTAL_ERRORES[r.error ?? "visita"] ?? PORTAL_ERRORES.visita);
        return;
      }
      const again = await portalVerAction(token, pin);
      if (again.ok) setData(again);
      setAbierta(null);
      setNombre("");
    });
  }

  const encabezado = (
    <div className="mx-auto flex items-center justify-center bg-white rounded-2xl shadow px-6 py-4 w-fit mb-5">
      <span className="inline-flex items-center gap-3">
        <BrandMark className="h-10 w-10" />
        <BrandWordmark theme="color" className="text-xl" />
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b2a27] via-[#0f3d38] to-[#153f3a] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        {encabezado}

        {!habilitado && (
          <div className="bg-white rounded-2xl p-6 text-sm text-slate-700">
            Este servicio todavía no está disponible. Comunicate con la clínica.
          </div>
        )}

        {habilitado && !data && (
          <form onSubmit={entrar} className="bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h1 className="text-base font-semibold text-slate-900">Visitas de tu familiar</h1>
              <p className="text-sm text-slate-600 mt-1">Ingresá el PIN de 6 números que figura en la tarjeta que te dio la clínica.</p>
            </div>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              aria-label="PIN de 6 números"
              className="w-full text-center tracking-[0.4em] text-2xl font-semibold rounded-xl border border-slate-300 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/50"
            />
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button
              disabled={pending || pin.length !== 6}
              className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-green)] text-white font-medium py-3 disabled:opacity-50"
            >
              {pending ? "Verificando…" : "Ver las visitas"}
            </button>
            <p className="text-xs text-slate-500">Es un acceso personal: no compartas el PIN ni el link.</p>
          </form>
        )}

        {habilitado && data?.ok && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-xl">
              <p className="text-xs text-slate-500">Visitas de</p>
              <h1 className="text-lg font-semibold text-slate-900">{data.paciente}</h1>
              {data.vence && <p className="text-xs text-slate-400 mt-1">Este acceso vence el {fechaCorta(data.vence)}.</p>}
            </div>

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <section className="bg-white rounded-2xl p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Próximas visitas</h2>
              {(data.proximas ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No hay visitas programadas por ahora. Si esperabas una, comunicate con la clínica.</p>
              ) : (
                <ul className="space-y-3">
                  {data.proximas!.map((v) => (
                    <li key={v.id} className="rounded-xl border border-slate-200 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-900">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}</span>
                        <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${v.estado === "confirmada" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {ESTADOS_PROXIMAS[v.estado] ?? v.estado}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 capitalize">{fechaLarga(v.fecha)} hs</p>
                      {v.profesional && <p className="text-xs text-slate-500">Con {v.profesional}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-2xl p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-slate-900">Visitas de las últimas semanas</h2>
              <p className="text-xs text-slate-500 mt-1 mb-3">Si la visita se hizo, podés confirmarlo con tu nombre. Es opcional y no reemplaza ningún consentimiento.</p>
              {(data.recientes ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay visitas registradas.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recientes!.map((v) => (
                    <li key={v.id} className="rounded-xl border border-slate-200 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-900">{SPECIALTY_LABELS[v.especialidad] ?? v.especialidad}</span>
                        <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${v.estado === "realizada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {v.estado === "realizada" ? "Realizada" : "No se pudo realizar"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 capitalize">{fechaLarga(v.fecha)} hs</p>
                      {v.profesional && <p className="text-xs text-slate-500">Con {v.profesional}</p>}

                      {v.estado === "realizada" && v.confirmada_at && (
                        <p className="text-xs text-emerald-700 mt-2">✓ Confirmada por {v.confirmada_por} el {fechaCorta(v.confirmada_at)}.</p>
                      )}
                      {v.estado === "realizada" && !v.confirmada_at && abierta !== v.id && (
                        <button
                          type="button"
                          onClick={() => { setAbierta(v.id); setError(null); }}
                          className="mt-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2"
                        >
                          Confirmar que se realizó
                        </button>
                      )}
                      {v.estado === "realizada" && !v.confirmada_at && abierta === v.id && (
                        <form onSubmit={(e) => { e.preventDefault(); confirmar(v); }} className="mt-2 space-y-2">
                          <input
                            required
                            maxLength={120}
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Tu nombre y apellido"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <button disabled={pending} className="rounded-lg bg-emerald-600 text-white text-sm font-medium px-3 py-2 disabled:opacity-50">
                              {pending ? "Guardando…" : "Confirmar"}
                            </button>
                            <button type="button" onClick={() => setAbierta(null)} className="rounded-lg text-slate-500 text-sm px-3 py-2">Cancelar</button>
                          </div>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-slate-300 text-center px-4">
              Acá solo ves fechas y estados de las visitas. Para consultas de salud o cambios de horario, comunicate con la clínica.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
