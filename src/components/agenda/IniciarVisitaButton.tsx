"use client";

import { useRef, useState } from "react";
import { iniciarVisitaAction } from "@/app/(dashboard)/agenda/actions";

/**
 * «Iniciar visita»: el profesional avisa que llegó al domicilio. Si el celular da la ubicación
 * se guarda junto con la hora; si no la da (o tarda más de 5 segundos) la visita se inicia igual.
 */
export default function IniciarVisitaButton({ visitId, className = "" }: { visitId: string; className?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const [esperando, setEsperando] = useState(false);

  function enviar() {
    formRef.current?.requestSubmit();
  }

  function onClick() {
    if (esperando) return;
    setEsperando(true);
    if (!navigator.geolocation) {
      enviar();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current) latRef.current.value = String(pos.coords.latitude);
        if (lngRef.current) lngRef.current.value = String(pos.coords.longitude);
        enviar();
      },
      () => enviar(),
      { timeout: 5000, maximumAge: 60000 }
    );
  }

  return (
    <form ref={formRef} action={iniciarVisitaAction}>
      <input type="hidden" name="visit_id" value={visitId} />
      <input ref={latRef} type="hidden" name="lat" />
      <input ref={lngRef} type="hidden" name="lng" />
      <button type="button" onClick={onClick} disabled={esperando} className={className}>
        {esperando ? "Iniciando…" : "Iniciar visita"}
      </button>
    </form>
  );
}
