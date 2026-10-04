import { requireProfile, ROLE_LABELS, ROLE_ACCENT, NAV_BY_ROLE } from "@/lib/auth";
import { logoutAction } from "./actions";
import AppShell, { LogoutButton } from "@/components/AppShell";
import FlashToast from "@/components/FlashToast";
import PatientSearch from "@/components/PatientSearch";

const CAN_SEARCH = ["administracion", "coordinador_internacion", "profesional_asistencial"];

export default async function DashboardLayout({
children,
}: {
children: React.ReactNode;
}) {
const { profile } = await requireProfile();
const nav = NAV_BY_ROLE[profile.role];
const accent = ROLE_ACCENT[profile.role];

return (
<AppShell
nav={nav}
fullName={profile.full_name}
roleLabel={ROLE_LABELS[profile.role]}
accent={accent}
logout={<LogoutButton action={logoutAction} />}
search={CAN_SEARCH.includes(profile.role) ? <PatientSearch /> : null}
>
{children}
<FlashToast />
</AppShell>
);
}
