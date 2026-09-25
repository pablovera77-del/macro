import { redirect } from "next/navigation";
import { requireProfile, NAV_BY_ROLE } from "@/lib/auth";

export default async function HomePage() {
  const { profile } = await requireProfile();
  const firstSection = NAV_BY_ROLE[profile.role][0];
  redirect(firstSection.href);
}
