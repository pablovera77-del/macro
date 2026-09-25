import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DF-C5 · Stock e Insumos — Profesionales SRL",
  description: "Mockup del módulo de Stock e Insumos Domiciliarios (DF-C5)",
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
