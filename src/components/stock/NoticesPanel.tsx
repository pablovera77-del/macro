import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";
import { TZ } from "@/lib/plan";
import { IconAlert } from "@/components/icons";
import type { ActionState } from "@/lib/stock-types";

export type Notice = {
  id: number;
  tipo: string;
  titulo: string;
  detalle: string | null;
  href: string | null;
  created_at: string;
};

// Avisos que le llegaron al rol o a la persona (autorizaciones nuevas, solicitudes, despachos…).
export default function NoticesPanel({
  notices,
  action,
  title = "Avisos para vos",
}: {
  notices: Notice[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  title?: string;
}) {
  if (notices.length === 0) return null;
  return (
    <section className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 animate-fade-slide-up">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
          <IconAlert className="w-4 h-4" />
        </span>
        <h2 className="text-sm font-medium text-blue-900">{title}</h2>
        <span className="text-xs text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">{notices.length}</span>
        {notices.length > 1 && (
          <ActionForm action={action} className="ml-auto">
            <SubmitButton className="text-xs text-blue-800 underline px-2 py-1">Marcar todos como leídos</SubmitButton>
          </ActionForm>
        )}
      </div>
      <ul className="space-y-2">
        {notices.map((n) => (
          <li key={n.id} className="bg-white rounded-xl border border-blue-100 px-3.5 py-2.5 text-sm flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900">{n.titulo}</div>
              {n.detalle && <div className="text-xs text-slate-600 mt-0.5">{n.detalle}</div>}
              <div className="text-[11px] text-slate-400 mt-0.5">
                {new Date(n.created_at).toLocaleString("es-AR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <ActionForm action={action}>
              <input type="hidden" name="notice_id" value={n.id} />
              <SubmitButton className="rounded-lg border border-blue-200 text-blue-800 text-xs font-medium px-3 py-1.5 hover:bg-blue-50" pendingLabel="…">
                Ya lo vi
              </SubmitButton>
            </ActionForm>
          </li>
        ))}
      </ul>
    </section>
  );
}
