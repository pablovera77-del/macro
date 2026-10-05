import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cierra la sesión y vuelve al login. Se usa cuando la cuenta está desactivada:
// sin esto el middleware lo devolvería a "/" y quedaría en un bucle de redirecciones.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const motivo = searchParams.get("error") === "cuenta_inactiva" ? "?error=cuenta_inactiva" : "";
  return NextResponse.redirect(`${origin}/login${motivo}`);
}
