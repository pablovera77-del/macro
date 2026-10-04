import type { Metadata } from "next";
import { familyPortalEnabled } from "@/lib/family";
import PortalClient from "./PortalClient";

// Página pública (sin menú ni sesión). No se indexa ni se manda el link a terceros.
export const metadata: Metadata = {
  title: "Visitas de tu familiar · Profesionales SRL",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function FamiliaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalClient token={token} habilitado={familyPortalEnabled()} />;
}
