import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ErpApaa | Sistema Integrado APAA Treinamento",
  description: "Sistema Integrado de Gestão Empresarial - APAA Treinamento",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
