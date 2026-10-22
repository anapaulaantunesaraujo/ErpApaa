"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Shield, Loader2 } from "lucide-react";
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
    <div className="flex items-center gap-3 sm:gap-4">
      {/* User Information */}
      <div className="flex items-center gap-3 text-right">
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            {user.name}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <Shield className="w-3 h-3" />
              {user.role === "ADMIN" ? "Administrador" : user.role}
            </span>
          </div>
        </div>

        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        title="Encerrar Sessão"
        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
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

