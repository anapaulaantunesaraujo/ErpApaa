"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield, Loader2 } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export default function UserNav({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4 font-sans">
      {/* Informações do Colaborador */}
      <div className="flex items-center gap-3 text-right">
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-foreground leading-tight">
            {user.name}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono tracking-wider uppercase font-medium bg-[#0B3D91]/10 text-[#0B3D91] border border-[#0B3D91]/20">
              <Shield className="w-3 h-3 text-[#FF7A00]" />
              {user.role === "ADMIN" ? "Administrador" : user.role}
            </span>
          </div>
        </div>

        {/* Monograma com a cor da marca Azul Tech */}
        <div className="w-10 h-10 rounded-xl bg-[#0B3D91] text-white flex items-center justify-center font-display font-bold text-sm shadow-sm border border-[#00A6FF]/40">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Botão de Encerrar Sessão */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        title="Encerrar Sessão"
        className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium shadow-sm"
      >
        {loggingOut ? (
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
        ) : (
          <>
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Sair</span>
          </>
        )}
      </button>
    </div>
  );
}
