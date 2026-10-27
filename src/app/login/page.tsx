"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Lock, Mail } from "lucide-react";
import { BrandMark, Wordmark, Circuit } from "@/components/Brand";
import { Button, Input, Checkbox } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Credenciais inválidas. Verifique seu e-mail e senha.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Erro de conexão com o servidor. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen font-sans lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* PAINEL DA MARCA (Desktop ≥ 1024px — Oculto no celular) */}
      <section className="relative hidden overflow-hidden bg-panel-gradient text-panel-foreground lg:flex lg:flex-col lg:justify-between lg:p-14 select-none">
        {/* Grade técnica de conexões */}
        <div className="grid-lines absolute inset-0 pointer-events-none opacity-70" aria-hidden />

        {/* Traços de circuito em ciano com nós laranja */}
        <Circuit className="pointer-events-none absolute -right-12 bottom-24 h-84 w-[30rem] text-highlight/30" />

        {/* Topo do painel: Identidade Oficial APAA */}
        <div className="relative flex items-center gap-3.5">
          <BrandMark tone="dark" />
          <Wordmark tone="dark" />
        </div>

        {/* Centro do painel: Slogan e Posicionamento Oficial da Marca */}
        <div className="relative max-w-lg my-auto py-12">
          <p className="mb-6 font-mono text-xs tracking-[0.28em] text-highlight uppercase font-medium">
            Consultoria · Desenvolvimento sob medida
          </p>
          <h1 className="font-display text-4xl xl:text-5xl leading-[1.12] font-bold text-white">
            Soluções em tecnologia{" "}
            <em className="text-highlight not-italic">para o seu negócio ir </em>
            <em className="text-accent not-italic">mais longe.</em>
          </h1>
          <p className="mt-6 text-panel-foreground/80 text-base leading-relaxed">
            Consultoria em sistemas e desenvolvimento sob medida para operações específicas — unindo tecnologia, experiência e foco em resultados reais.
          </p>
        </div>

        {/* Rodapé do painel: Os 3 Serviços Oficiais da APAA e Selo Interno */}
        <div className="relative flex items-end justify-between gap-10 border-t border-panel-foreground/15 pt-8 text-sm">
          <div className="flex gap-8 xl:gap-10">
            {[
              ["Consultoria", "Em Sistemas"],
              ["Desenvolvimento", "Sob Medida"],
              ["Integrações", "E Automação"],
            ].map(([title, subtitle]) => (
              <div key={title}>
                <p className="font-display text-lg font-bold text-white tracking-tight">{title}</p>
                <p className="text-panel-foreground/60 text-xs mt-0.5">{subtitle}</p>
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-panel-foreground/50 uppercase whitespace-nowrap">
            Ambiente interno
          </p>
        </div>
      </section>

      {/* ÁREA DO FORMULÁRIO (Mobile & Desktop) */}
      <section className="flex flex-col justify-center items-center px-6 py-12 sm:px-10 min-h-screen">
        <div className="w-full max-w-[360px] sm:max-w-[384px]">
          {/* Identidade no topo (Visível no Mobile < 1024px) */}
          <div className="mb-8 sm:mb-10 flex items-center gap-3.5 lg:hidden">
            <BrandMark tone="light" />
            <Wordmark tone="light" />
          </div>

          {/* Título e Subtítulo Oficial */}
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight">
            Bem-vindo de<br className="hidden sm:inline" /> volta
          </h2>
          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
            Entre com seu e-mail corporativo para continuar.
          </p>

          {/* Formulário com Design System Padronizado */}
          <form onSubmit={handleSubmit} className="mt-8 sm:mt-10 space-y-5">
            {/* Mensagem de Erro Inline */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3 text-sm rounded-[10px] bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 animate-in fade-in duration-150"
              >
                <span className="font-bold text-red-500 leading-none mt-0.5">•</span>
                <span className="flex-1 leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Campo E-mail */}
            <Input
              label="E-mail"
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@apaa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
            />

            {/* Campo Senha */}
            <Input
              label="Senha"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              extra={
                <a
                  href="#recuperar-senha"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Para recuperação de senha corporativa, entre em contato com o administrador do sistema.");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Esqueceu a senha?
                </a>
              }
              rightAction={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {/* Checkbox Manter Conectado */}
            <div className="pt-0.5">
              <Checkbox
                id="rememberMe"
                label="Manter conectado"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
            </div>

            {/* Botão Entrar Oficial da Apaa (Azul Tech #0B3D91) */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={loading}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          </form>

          {/* Nota de Rodapé Corporativa */}
          <p className="mt-8 sm:mt-10 text-center text-xs text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
            Acesso restrito a colaboradores. Problemas? Fale com o administrador.
          </p>
        </div>
      </section>
    </main>
  );
}
