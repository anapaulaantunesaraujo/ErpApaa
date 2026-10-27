import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MainHeader from "@/components/MainHeader";
import { BrandMark, Wordmark, Circuit } from "@/components/Brand";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
} from "@/components/ui";
import {
  Wallet,
  ReceiptText,
  ArrowDownRight,
  ArrowUpRight,
  FileSpreadsheet,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  Server,
  Shield,
  Activity,
  Users,
  FileText,
  ChevronRight,
  Monitor,
  Code2,
  Cloud,
  AlertCircle,
  FolderArchive,
} from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Busca dados REAIS agregados no banco de dados
  let payablesPending: any[] = [];
  let receivablesPending: any[] = [];
  let nfseCount = 0;
  let clientsCount = 0;
  let latestPayables: any[] = [];
  let latestReceivables: any[] = [];
  let latestNfse: any[] = [];
  let latestStatement: any = null;

  try {
    const [
      payables,
      receivables,
      nfseC,
      clientsC,
      payablesList,
      receivablesList,
      nfseList,
      statement,
    ] = await Promise.all([
      prisma.payable.findMany({
        where: { status: { in: ["PENDENTE", "PARCIAL"] } },
        select: { valorOriginal: true, valorPago: true },
      }),
      prisma.receivable.findMany({
        where: { status: { in: ["PENDENTE", "PARCIAL"] } },
        select: { valorOriginal: true, valorRecebido: true },
      }),
      prisma.nfseEmission.count({ where: { status: "EMITIDA" } }),
      prisma.customer.count({ where: { ativo: true } }),
      prisma.payable.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.receivable.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.nfseEmission.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { cliente: true },
      }),
      prisma.bankStatement.findFirst({
        orderBy: { createdAt: "desc" },
        include: {
          transacoes: { take: 5, orderBy: { data: "desc" } },
        },
      }),
    ]);

    payablesPending = payables;
    receivablesPending = receivables;
    nfseCount = nfseC;
    clientsCount = clientsC;
    latestPayables = payablesList;
    latestReceivables = receivablesList;
    latestNfse = nfseList;
    latestStatement = statement;
  } catch (err) {
    console.error("Aviso ao carregar dados reais do dashboard:", err);
  }

  // Cálculos dinâmicos com dados reais
  const totalPagarPendente = payablesPending.reduce(
    (acc, p) => acc + (p.valorOriginal - p.valorPago),
    0
  );
  const totalReceberPendente = receivablesPending.reduce(
    (acc, r) => acc + (r.valorOriginal - r.valorRecebido),
    0
  );

  // Pilares institucionais da APAA Treinamento
  const brandServices = [
    {
      title: "Consultoria em Sistemas",
      icon: <Monitor className="w-5 h-5 text-[#00A6FF]" />,
      desc: "Análise de processos, levantamento de requisitos, integrações e melhoria do uso dos sistemas empresariais.",
      tag: "Processos & Diagnóstico",
    },
    {
      title: "Desenvolvimento sob Medida",
      icon: <Code2 className="w-5 h-5 text-[#FF7A00]" />,
      desc: "Aplicações personalizadas para necessidades operacionais específicas, automações e ferramentas internas.",
      tag: "Sistemas & Apps",
    },
    {
      title: "Integrações e Automação",
      icon: <Cloud className="w-5 h-5 text-[#0B3D91]" />,
      desc: "Conexão entre sistemas, APIs, dados e processos para reduzir tarefas manuais e aumentar a produtividade.",
      tag: "APIs & Eficiência",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <MainHeader user={user} />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner Hero Institucional */}
        <section className="relative overflow-hidden rounded-2xl bg-[#06152d] text-white p-8 sm:p-10 shadow-lg border border-white/10">
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#00A6FF_1px,transparent_1px)] [background-size:16px_16px]" aria-hidden />
          <Circuit className="pointer-events-none absolute -right-10 -bottom-10 h-72 w-96 text-[#00A6FF]/20" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#00A6FF]/15 border border-[#00A6FF]/30 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span className="font-mono text-xs tracking-[0.2em] text-[#00A6FF] uppercase font-semibold">
                ERP Integrado APAA Treinamento
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
              Soluções em tecnologia{" "}
              <em className="text-[#00A6FF] not-italic">para o seu negócio ir </em>
              <em className="text-[#FF7A00] not-italic">mais longe.</em>
            </h1>
            <p className="mt-3.5 text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
              Olá, <strong className="text-white font-semibold">{user.name}</strong>. Painel financeiro, emissão de notas fiscais e conciliação bancária integrados em tempo real.
            </p>

            {/* Ações Rápidas com Links Reais do Sistema */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/financeiro"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white font-semibold text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-[#00A6FF]" />
                <span>Gerenciar Contas a Pagar</span>
              </a>
              <a
                href="/nfse"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A6FF] hover:bg-[#0091e0] text-white font-semibold text-xs shadow-sm transition-all"
              >
                <ReceiptText className="w-4 h-4" />
                <span>Emitir NFS-e Nacional</span>
              </a>
              <a
                href="/financeiro"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#FF7A00]" />
                <span>Conciliação Sicredi</span>
              </a>
            </div>
          </div>
        </section>

        {/* Indicadores Reais do Banco de Dados */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Contas a Pagar */}
          <Card hoverEffect className="p-5">
            <div className="flex items-center justify-between pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Contas a Pagar Pendentes
              </span>
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>
            <div className="pt-1">
              <p className="text-2xl font-bold font-mono text-red-600">
                R$ {totalPagarPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {payablesPending.length} {payablesPending.length === 1 ? "título pendente" : "títulos pendentes"}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
              <a href="/financeiro" className="text-[#0B3D91] font-semibold hover:underline flex items-center gap-1">
                <span>Ver financeiro</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </Card>

          {/* Card 2: Contas a Receber */}
          <Card hoverEffect className="p-5">
            <div className="flex items-center justify-between pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Contas a Receber Pendentes
              </span>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="pt-1">
              <p className="text-2xl font-bold font-mono text-emerald-600">
                R$ {totalReceberPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {receivablesPending.length} {receivablesPending.length === 1 ? "recebimento pendente" : "recebimentos pendentes"}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
              <a href="/financeiro" className="text-emerald-700 font-semibold hover:underline flex items-center gap-1">
                <span>Ver a receber</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </Card>

          {/* Card 3: NFS-e Nacional */}
          <Card hoverEffect className="p-5">
            <div className="flex items-center justify-between pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                NFS-e Emitidas (2026)
              </span>
              <div className="p-2 rounded-lg bg-[#00A6FF]/15 text-[#0077CC]">
                <ReceiptText className="w-5 h-5" />
              </div>
            </div>
            <div className="pt-1">
              <p className="text-2xl font-bold font-mono text-foreground">{nfseCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Notas fiscais autorizadas no ano</p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
              <a href="/nfse" className="text-[#00A6FF] font-semibold hover:underline flex items-center gap-1">
                <span>Emitir nota fiscal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </Card>

          {/* Card 4: Clientes Cadastrados */}
          <Card hoverEffect className="p-5">
            <div className="flex items-center justify-between pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Clientes & Tomadores
              </span>
              <div className="p-2 rounded-lg bg-[#FF7A00]/10 text-[#FF7A00]">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="pt-1">
              <p className="text-2xl font-bold font-mono text-foreground">{clientsCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Clientes com cadastro ativo</p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
              <a href="/nfse" className="text-[#FF7A00] font-semibold hover:underline flex items-center gap-1">
                <span>Gerenciar tomadores</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </Card>
        </section>

        {/* Últimos Lançamentos Reais do Sistema */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Movimentações & Títulos Recentes
              </h2>
              <p className="text-xs text-muted-foreground">
                Últimos registros cadastrados no banco de dados do sistema
              </p>
            </div>
            <a
              href="/financeiro"
              className="text-xs font-semibold text-[#0B3D91] hover:underline flex items-center gap-1"
            >
              <span>Ver painel completo</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela de Contas a Pagar Recentes */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                <span>Últimas Contas a Pagar</span>
              </h3>

              {latestPayables.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-border p-4">
                  <p className="font-semibold text-foreground">Nenhuma conta a pagar cadastrada</p>
                  <p className="mt-1">Cadastre as contas de fornecedores ou importe via IA.</p>
                  <a
                    href="/financeiro"
                    className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-[#0B3D91] text-white text-xs font-semibold"
                  >
                    + Cadastrar Título
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {latestPayables.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{p.fornecedorNome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.descricao} · Venc: {new Date(p.dataVencimento).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-red-600">
                          R$ {p.valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            p.status === "PAGO"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabela de Contas a Receber Recentes */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span>Últimas Contas a Receber</span>
              </h3>

              {latestReceivables.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-border p-4">
                  <p className="font-semibold text-foreground">Nenhum recebimento cadastrado</p>
                  <p className="mt-1">Emita uma NFS-e Nacional ou lance títulos a receber.</p>
                  <a
                    href="/nfse"
                    className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-[#00A6FF] text-white text-xs font-semibold"
                  >
                    Emitir NFS-e Nacional
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {latestReceivables.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{r.clienteNome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.descricao} {r.numeroNf ? `· NF: ${r.numeroNf}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-emerald-600">
                          R$ {r.valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            r.status === "RECEBIDO"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Serviços Oficiais da APAA (Mapa da Marca) */}
        <section id="servicos" className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold text-[#FF7A00] bg-[#FF7A00]/10 border border-[#FF7A00]/25 mb-1.5">
                <span>SERVIÇOS ESSENCIAIS</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Frentes de Atuação APAA Treinamento
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
              Tecnologia e estratégia para conectar processos, pessoas e resultados reais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {brandServices.map((svc) => (
              <div
                key={svc.title}
                className="p-5 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/40 hover:border-[#00A6FF]/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-card border border-border">
                    {svc.icon}
                  </div>
                  <Badge variant="tech" size="sm">
                    {svc.tag}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {svc.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {svc.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer Institucional */}
      <footer className="border-t border-border bg-card mt-12 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark tone="light" size={32} />
            <div className="text-left">
              <span className="font-bold text-foreground">
                APAA Treinamento & Consultoria
              </span>
              <p className="text-[11px] text-muted-foreground">
                Soluções em tecnologia para o seu negócio ir mais longe.
              </p>
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} APAA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
