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
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 dark:bg-[#06152d]/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Identidade da Marca APAA */}
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-3 group">
            <BrandMark size={40} />
            <div className="hidden sm:block">
              <Wordmark />
              <p className="text-[10px] font-mono tracking-widest text-[#00A6FF] uppercase font-semibold">
                ERP Integrado
              </p>
            </div>
          </a>

          {/* Navegação Principal */}
          <nav className="hidden md:flex items-center gap-1 border-l border-border pl-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#0B3D91] text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#00A6FF]" : ""}`} />
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
      <div className="md:hidden flex items-center justify-around border-t border-border py-2 px-2 bg-slate-50 dark:bg-slate-900/60 text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${
                isActive ? "text-[#0B3D91] font-bold" : "text-muted-foreground"
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
