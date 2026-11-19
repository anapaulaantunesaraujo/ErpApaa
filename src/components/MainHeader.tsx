"use client";

import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { BrandMark, Wordmark } from "@/components/Brand";
import UserNav from "@/components/UserNav";
import type { SessionUser } from "@/lib/auth";
import { LayoutDashboard, Wallet, ReceiptText, Settings } from "lucide-react";

export default function MainHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  const navItems = [
    { label: "Início", href: "/", icon: LayoutDashboard },
    { label: "Financeiro", href: "/financeiro", icon: Wallet },
    { label: "Emissor NFS-e", href: "/nfse", icon: ReceiptText },
    { label: "Configurações", href: "/configuracoes", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#0B3D91]/30 bg-[#0B2545] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Identidade da Marca APAA */}
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-3 group">
            <BrandMark size={42} tone="dark" />
            <div className="hidden sm:block">
              <Wordmark tone="dark" />
              <p className="text-[10px] font-mono tracking-widest text-[#00A6FF] uppercase font-bold mt-0.5">
                ERP Integrado
              </p>
            </div>
          </a>

          {/* Navegação Principal */}
          <nav className="hidden md:flex items-center gap-1.5 border-l border-white/20 pl-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#00A6FF] text-[#06152d] shadow-sm font-extrabold"
                      : "text-slate-100 hover:text-white hover:bg-white/15"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#06152d]" : "text-[#00A6FF]"}`} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Informações do Usuário & Sair */}
        <UserNav user={user} />
      </div>

      {/* Subnavegação Mobile */}
      <div className="md:hidden flex items-center justify-around border-t border-white/15 py-2.5 px-2 bg-[#081f3b] text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${
                isActive ? "text-[#00A6FF] font-bold" : "text-slate-300 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px]">{item.label}</span>
            </a>
          );
        })}
      </div>
    </header>
  );
}
