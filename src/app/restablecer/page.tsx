"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandMark, BrandWordmark } from "@/components/BrandLogo";

// Pantalla a la que llega la persona desde el link del mail: elige una contraseña nueva.
export default function RestablecerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== repeat) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("No se pudo cambiar la contraseña. Pedí un link nuevo desde la pantalla de ingreso.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b2a27] via-[#0f3d38] to-[#153f3a] px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="mx-auto flex items-center justify-center bg-white/95 rounded-2xl shadow-lg px-8 py-6 w-fit">
          <span className="inline-flex flex-col items-center gap-2">
            <BrandMark className="h-12 w-12" />
            <BrandWordmark theme="color" className="text-2xl" />
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div>
            <h1 className="text-base font-semibold text-white">Elegí tu nueva contraseña</h1>
            <p className="text-xs text-slate-400 mt-1">Mínimo 8 caracteres. Con ella vas a ingresar de ahora en más.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Contraseña nueva</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Repetila</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]/50"
            />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-green)] text-white text-sm font-medium py-2.5 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-black/30"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
