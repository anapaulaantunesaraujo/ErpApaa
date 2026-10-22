import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UserNav from "@/components/UserNav";
import { ShieldCheck, LayoutGrid, Sparkles } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                APAA Treinamento
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                ERP
              </span>
            </div>
          </div>

          <UserNav user={user} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Page Title Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Início
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Painel principal do sistema ERP APAA Treinamento
          </p>
        </div>

        {/* Clean Canvas / Initial Blank State */}
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
            <LayoutGrid className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Ambiente Pronto para Novos Módulos
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            A estrutura base, autenticação segura e conexão com o banco de dados estão configuradas. Os módulos e atalhos desta tela serão definidos conforme as próximas etapas do projeto.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sessão ativa: {user.email} ({user.role})</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        © {new Date().getFullYear()} APAA Treinamento. Todos os direitos reservados.
      </footer>
    </div>
  );
}
