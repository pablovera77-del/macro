import { requireProfile, ROLE_LABELS, ROLE_ACCENT, NAV_BY_ROLE } from "@/lib/auth";
import { logoutAction } from "./actions";
import AppShell, { LogoutButton } from "@/components/AppShell";
import FlashToast from "@/components/FlashToast";
import PatientSearch from "@/components/PatientSearch";
import { createClient } from "@/lib/supabase/server";

const CAN_SEARCH = ["administracion", "coordinador_internacion", "profesional_asistencial", "facturacion"];

export default async function DashboardLayout({
children,
}: {
children: React.ReactNode;
}) {
const { profile } = await requireProfile();
const nav = NAV_BY_ROLE[profile.role];
const accent = ROLE_ACCENT[profile.role];
// Avisos sin leer para la campana (si falla la consulta, la campana queda sin número).
const supabase = await createClient();
const { count: notifCount } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);

return (
<AppShell
nav={nav}
fullName={profile.full_name}
roleLabel={ROLE_LABELS[profile.role]}
accent={accent}
logout={<LogoutButton action={logoutAction} />}
notifCount={notifCount ?? 0}
search={CAN_SEARCH.includes(profile.role) ? <PatientSearch /> : null}
>
{children}
<FlashToast />
</AppShell>
);
}
