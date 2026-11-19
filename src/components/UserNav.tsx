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
          <p className="text-sm font-bold text-white leading-tight">
            {user.name}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase font-bold bg-[#00A6FF]/20 text-[#00A6FF] border border-[#00A6FF]/40">
              <Shield className="w-3 h-3 text-[#FF7A00]" />
              {user.role === "ADMIN" ? "Administrador" : user.role}
            </span>
          </div>
        </div>

        {/* Monograma com a cor da marca Azul Tech */}
        <div className="w-10 h-10 rounded-xl bg-[#00A6FF] text-[#06152d] flex items-center justify-center font-display font-extrabold text-sm shadow-sm border border-white/20">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Botão de Encerrar Sessão */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        title="Encerrar Sessão"
        className="px-3 py-2 rounded-xl border border-white/25 bg-white/10 text-white hover:text-white hover:border-red-400 hover:bg-red-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm"
      >
        {loggingOut ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <>
            <LogOut className="w-4 h-4 text-white" />
            <span className="hidden md:inline">Sair</span>
          </>
        )}
      </button>
    </div>
  );
}
