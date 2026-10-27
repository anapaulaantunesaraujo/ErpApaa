import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UserNav from "@/components/UserNav";
import { BrandMark, Wordmark, Circuit } from "@/components/Brand";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from "@/components/ui";
import {
  Monitor,
  Code2,
  Cloud,
  Database,
  Settings,
  FolderKanban,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
  FileText,
  Activity,
  Sparkles,
  Server,
  ChevronRight,
  Shield,
  Briefcase,
  Layers,
} from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Exemplos de projetos de sistemas sob medida e consultoria
  const activeProjects = [
    {
      id: "PRJ-2026-08",
      name: "Portal Corporativo Omnichannel",
      client: "Grupo Fleury Saúde",
      service: "Desenvolvimento sob Medida",
      stack: "Next.js · Node.js · PostgreSQL",
      progress: 88,
      status: "HOMOLOGAÇÃO",
      statusVariant: "accent" as const,
      deadline: "28/10/2026",
    },
    {
      id: "PRJ-2026-11",
      name: "App Mobile de Gestão Logística",
      client: "LogTrans Transportes",
      service: "Solução Sob Medida",
      stack: "Flutter · Go · AWS Cloud",
      progress: 62,
      status: "EM ANDAMENTO",
      statusVariant: "primary" as const,
      deadline: "14/11/2026",
    },
    {
      id: "PRJ-2026-05",
      name: "Integração de APIs e Microsserviços",
      client: "Votorantim Soluções",
      service: "Integrações & Automação",
      stack: "NestJS · Apache Kafka",
      progress: 95,
      status: "FASE FINAL",
      statusVariant: "success" as const,
      deadline: "30/10/2026",
    },
    {
      id: "PRJ-2026-14",
      name: "Consultoria em Arquitetura e BI",
      client: "FinTech Prime Capital",
      service: "Consultoria em Sistemas",
      stack: "React · Python · PowerBI",
      progress: 42,
      status: "SPRINT 3",
      statusVariant: "highlight" as const,
      deadline: "05/12/2026",
    },
  ];

  // Serviços e Frentes de Atuação do Manual da Marca APAA
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

  // Atividades recentes do ambiente interno
  const recentActivities = [
    {
      id: 1,
      title: "Deploy em Homologação realizado",
      desc: "Versão 1.4.2 do Portal Corporativo enviada para validação técnica.",
      time: "Há 18 min",
      badge: "DEPLOY",
      variant: "primary" as const,
    },
    {
      id: 2,
      title: "Contrato assinado & Briefing aprovado",
      desc: "Novo projeto 'FinTech Prime Capital' iniciado com sucesso.",
      time: "Há 2 horas",
      badge: "CONTRATO",
      variant: "accent" as const,
    },
    {
      id: 3,
      title: "Conciliação Financeira quinzenal",
      desc: "Fechamento de faturamento de consultoria concluído com 100% de precisão.",
      time: "Ontem, 17:40",
      badge: "FINANÇAS",
      variant: "warning" as const,
    },
    {
      id: 4,
      title: "Entrega de Sprint concluída",
      desc: "Equipe entregou 14 requisitos de automação dentro da meta estipulada.",
      time: "21/10/2026",
      badge: "EQUIPE",
      variant: "highlight" as const,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Top Header Corporativo com Identidade APAA */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo Oficial APAA */}
          <div className="flex items-center gap-3.5">
            <BrandMark tone="light" />
            <div className="hidden sm:block">
              <Wordmark tone="light" />
            </div>

            {/* Divisor sutil */}
            <div className="hidden md:block h-7 w-[1px] bg-border mx-2" />

            {/* Selo técnico */}
            <Badge variant="tech" dot className="hidden md:inline-flex">
              Ambiente Interno · v2.4
            </Badge>
          </div>

          {/* Navegação Rápida dos Pilares */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            <span className="px-3.5 py-2 rounded-lg text-primary bg-[#0B3D91]/10 font-semibold cursor-default">
              Visão Geral
            </span>
            <a
              href="#servicos"
              className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            >
              Serviços
            </a>
            <a
              href="#projetos"
              className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            >
              Projetos
            </a>
            <a
              href="#clientes"
              className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            >
              Clientes
            </a>
            <a
              href="#financas"
              className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            >
              Finanças
            </a>
          </nav>

          {/* Navegação do Usuário e Logout */}
          <UserNav user={user} />
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner Hero Tecnológico com Slogan Oficial */}
        <section className="relative overflow-hidden rounded-2xl bg-panel-gradient text-panel-foreground p-8 sm:p-10 shadow-elegant border border-panel-foreground/15">
          <div className="grid-lines absolute inset-0 pointer-events-none opacity-60" aria-hidden />
          <Circuit className="pointer-events-none absolute -right-10 -bottom-10 h-72 w-96 text-highlight/25" />

          <div className="relative z-10 max-w-3xl">
            {/* Tag técnica */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-highlight/15 border border-highlight/30 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="font-mono text-xs tracking-[0.2em] text-highlight uppercase font-semibold">
                Consultoria em Sistemas · Apps sob Medida
              </span>
            </div>

            {/* Slogan Oficial da Marca APAA em Montserrat */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-white">
              Soluções em tecnologia{" "}
              <em className="text-highlight not-italic">para o seu negócio ir </em>
              <em className="text-accent not-italic">mais longe.</em>
            </h1>
            <p className="mt-3.5 text-panel-foreground/80 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
              Olá, <strong className="text-white font-semibold">{user.name}</strong>. Gestão centralizada de projetos sob medida, clientes estratégicos e controle financeiro da APAA.
            </p>

            {/* Botões do Design System: Azul Tech + Laranja Oficial */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                iconLeft={<Plus className="w-4 h-4" />}
              >
                Novo Projeto
              </Button>
              <Button
                variant="accent"
                size="md"
                iconLeft={<Code2 className="w-4 h-4" />}
              >
                Nova Demanda sob Medida
              </Button>
              <Button
                variant="outline"
                size="md"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
                iconLeft={<FileText className="w-4 h-4 text-highlight" />}
              >
                Relatório Operacional
              </Button>
            </div>
          </div>
        </section>

        {/* Pilares Principais (Cards de Indicadores Chave / KPIs) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Pilar 1: Projetos / Gestão */}
          <Card hoverEffect>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Projetos & Gestão
              </span>
              <div className="p-2 rounded-lg bg-[#0B3D91]/10 text-primary">
                <FolderKanban className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold text-foreground">18</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sistemas e Apps em Execução</p>
            </CardContent>
            <CardFooter>
              <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 4 entregas esta semana
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">96.4% no prazo</span>
            </CardFooter>
          </Card>

          {/* Pilar 2: Clientes / Relacionamento */}
          <Card hoverEffect>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Clientes & Parcerias
              </span>
              <div className="p-2 rounded-lg bg-[#00A6FF]/15 text-[#0077CC]">
                <Users className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold text-foreground">42</p>
              <p className="text-xs text-muted-foreground mt-0.5">Contas Corporativas Ativas</p>
            </CardContent>
            <CardFooter>
              <span className="text-[#FF7A00] font-semibold inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> NPS 94.8 Excelente
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">+3 propostas</span>
            </CardFooter>
          </Card>

          {/* Pilar 3: Finanças / Controle */}
          <Card hoverEffect>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Faturamento & Controle
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold text-foreground">R$ 384k</p>
              <p className="text-xs text-muted-foreground mt-0.5">Receita Mensal de Consultoria</p>
            </CardContent>
            <CardFooter>
              <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% vs mês anterior
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Margem 34%</span>
            </CardFooter>
          </Card>

          {/* Pilar 4: Equipe / Consultores Especialistas */}
          <Card hoverEffect>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Equipe Especialista
              </span>
              <div className="p-2 rounded-lg bg-[#FF7A00]/10 text-[#FF7A00]">
                <Briefcase className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold text-foreground">26</p>
              <p className="text-xs text-muted-foreground mt-0.5">Consultores & Desenvolvedores</p>
            </CardContent>
            <CardFooter>
              <span className="text-primary font-medium inline-flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#00A6FF]" /> 89% Ocupação
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">4 Squads</span>
            </CardFooter>
          </Card>
        </section>

        {/* Serviços Oficiais da APAA (Mapa da Marca) */}
        <section id="servicos" className="rounded-2xl border border-border bg-gradient-to-br from-white to-slate-50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold text-[#FF7A00] bg-[#FF7A00]/10 border border-[#FF7A00]/25 mb-1.5">
                <span>SERVIÇOS ESSENCIAIS</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                Frentes de Atuação APAA
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
                className="p-5 rounded-xl border border-border bg-card hover:border-[#00A6FF]/40 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    {svc.icon}
                  </div>
                  <Badge variant="tech" size="sm">
                    {svc.tag}
                  </Badge>
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  {svc.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {svc.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Seção Principal: Projetos em Destaque + Coluna Lateral */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Esquerda: Projetos em Andamento */}
          <section id="projetos" className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Projetos & Sistemas sob Medida
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Do briefing à entrega contínua com excelência técnica
                </p>
              </div>
              <a
                href="#todos-projetos"
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 group"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>

            {/* Lista de Projetos com Cards Padronizados */}
            <div className="space-y-4">
              {activeProjects.map((project) => (
                <Card key={project.id} hoverEffect className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground tracking-wider font-semibold">
                          {project.id}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs font-medium text-primary">
                          {project.client}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-foreground mt-1">
                        {project.name}
                      </h3>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        {project.service} · Stack: <span className="text-foreground font-medium">{project.stack}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={project.statusVariant}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Barra de Progresso com gradiente Azul Tech -> Azul Claro */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        Entrega prevista: <strong className="text-foreground">{project.deadline}</strong>
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {project.progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-highlight rounded-full transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Coluna Direita: Atividades Recentes & Infraestrutura */}
          <aside className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg">Atividades Recentes</CardTitle>
                <Badge variant="tech" size="sm">Tempo Real</Badge>
              </div>

              <div className="space-y-4">
                {recentActivities.map((act) => (
                  <div key={act.id} className="relative pl-5 border-l-2 border-slate-200 pb-3 last:pb-0">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-white" />
                    <div className="flex items-center justify-between">
                      <Badge variant={act.variant} size="sm">
                        {act.badge}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{act.time}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mt-1">{act.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{act.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Infraestrutura & Parceria</CardTitle>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-muted-foreground">PostgreSQL Database</span>
                  <Badge variant="success" size="sm" dot>
                    ONLINE
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-muted-foreground">Sessão JWT Segura</span>
                  <Badge variant="primary" size="sm">
                    <Shield className="w-3 h-3 text-[#FF7A00]" />
                    CRIPTOGRAFADA
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-muted-foreground">Uptime de Sistemas</span>
                  <span className="font-mono text-[11px] font-semibold text-primary">
                    99.98%
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Ambiente Interno Apaa · Acesso Restrito
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </main>

      {/* Footer Institucional com Slogan da Marca */}
      <footer className="border-t border-border bg-card mt-12 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark tone="light" size={32} />
            <div className="text-left">
              <span className="font-display font-bold text-foreground">
                APAA Consultoria e Desenvolvimento
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
