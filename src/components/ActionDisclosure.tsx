import { IconChevronDown } from "@/components/icons";

/**
 * Visible, button-styled progressive disclosure for a secondary action
 * inside a list row (e.g. "cargar autorización", "gestionar paciente").
 * Replaces the old pattern of a small gray "+ ..." text link, which
 * tested as easy to miss — the action exists but nobody could find it.
 * Stays collapsed by default (native <details>) so dense lists don't
 * balloon, but now reads as a clickable action, not a hidden detail.
 */
export default function ActionDisclosure({
  label,
  tone = "default",
  className = "",
  children,
}: {
  label: string;
  tone?: "default" | "subtle";
  className?: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "subtle"
      ? "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
      : "bg-slate-900 text-white hover:bg-slate-800";
  return (
    <details className={`group mt-3 ${className}`}>
      <summary
        className={`list-none inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors w-fit select-none ${toneClass}`}
      >
        {label}
        <IconChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
