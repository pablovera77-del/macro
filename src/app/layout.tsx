import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Profesionales SRL · Gestión de internación domiciliaria",
  description: "Plataforma de gestión de internación domiciliaria — Profesionales SRL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
