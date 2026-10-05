import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import LlegadaClient from "./LlegadaClient";

// Página pública (sin menú ni sesión): la familia confirma con un botón que el paciente llegó al domicilio.
// Solo muestra el primer nombre del paciente. No se indexa.
export const metadata: Metadata = {
  title: "Confirmar llegada · Profesionales SRL",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Info = { ok: boolean; error?: string; ya_confirmado?: boolean; nombre?: string };

export default async function LlegadaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let info: Info = { ok: false, error: "invalido" };
  if (/^[0-9a-f]{20,64}$/.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("fn_arrival_info", { p_token: token });
    if (data) info = data as Info;
  }
  return (
    <main className="min-h-dvh flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center space-y-4">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Profesionales SRL · Internación domiciliaria</p>
        <LlegadaClient token={token} info={info} />
      </div>
    </main>
  );
}
