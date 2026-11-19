import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APAA Consultoria e Desenvolvimento | Soluções em Tecnologia",
  description: "Soluções em tecnologia para o seu negócio ir mais longe. Consultoria em sistemas e desenvolvimento sob medida.",
  icons: {
    icon: "/brand/apaa-symbol.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans selection:bg-[#0B3D91] selection:text-white">
        {children}
      </body>
    </html>
  );
}
