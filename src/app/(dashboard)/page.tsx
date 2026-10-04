import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

// Al entrar, cada rol cae en su pantalla de Inicio ("¿Qué querés hacer?"),
// no en la primera sección del menú — antes nadie entendía dónde estaba.
export default async function HomePage() {
  await requireProfile();
  redirect("/inicio");
}
