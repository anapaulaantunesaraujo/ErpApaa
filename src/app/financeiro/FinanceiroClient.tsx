"use client";

import { useState, useEffect } from "react";
import type { SessionUser } from "@/lib/auth";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  FileSpreadsheet,
  FolderArchive,
  Bot,
  Plus,
  Download,
  Send,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
  Calendar,
  DollarSign,
  Search,
  Sparkles,
} from "lucide-react";

interface FinanceiroClientProps {
  user: SessionUser;
}

export default function FinanceiroClient({ user }: FinanceiroClientProps) {
  const [activeTab, setActiveTab] = useState<"pagar" | "receber" | "extrato" | "fechamento" | "ia">("pagar");

  // Dados de Contas a Pagar e Receber
  const [payables, setPayables] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mês e Ano de competência para filtros e fechamento
  const now = new Date();
  const [selectedMes, setSelectedMes] = useState<number>(now.getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState<number>(now.getFullYear());

  // Estado para cadastro de nova conta a pagar
  const [showNewPayableModal, setShowNewPayableModal] = useState(false);
  const [newPayableForm, setNewPayableForm] = useState({
    descricao: "",
    fornecedorNome: "",
    fornecedorCpfCnpj: "",
    numeroDocumento: "",
    valorOriginal: "",
    dataVencimento: "",
    categoria: "GERAL",
  });

  // Estado para modal de baixa
  const [baixaModal, setBaixaModal] = useState<{
    open: boolean;
    tipo: "PAGAR" | "RECEBER";
    item: any;
    valor: string;
    data: string;
    forma: string;
  }>({
    open: false,
    tipo: "PAGAR",
    item: null,
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    forma: "PIX",
  });

  // Estado para upload do extrato (3 arquivos)
  const [ofxFile, setOfxFile] = useState<File | null>(null);
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingExtrato, setUploadingExtrato] = useState(false);
  const [extratoStatement, setExtratoStatement] = useState<any>(null);

  // Estado para envio de e-mail de fechamento
  const [emailDestinatario, setEmailDestinatario] = useState("");
  const [emailAssunto, setEmailAssunto] = useState("");
  const [emailMensagem, setEmailMensagem] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // Estado para análise de arquivo com IA
  const [iaFile, setIaFile] = useState<File | null>(null);
  const [analyzingIa, setAnalyzingIa] = useState(false);
  const [iaResult, setIaResult] = useState<any>(null);

  // Carrega dados reais do banco de dados para o mês selecionado
  const loadFinanceiroData = async () => {
    setLoading(true);
    try {
      const compStr = `${selectedAno}-${String(selectedMes).padStart(2, "0")}`;
      const [resPagar, resReceber, resExtrato] = await Promise.all([
        fetch(`/api/financeiro/contas-pagar?competencia=${compStr}`),
        fetch(`/api/financeiro/contas-receber?competencia=${compStr}`),
        fetch(`/api/financeiro/extratos?mes=${selectedMes}&ano=${selectedAno}`),
      ]);

      const dataPagar = await resPagar.json();
      const dataReceber = await resReceber.json();
      const dataExtrato = await resExtrato.json();

      if (dataPagar.items) setPayables(dataPagar.items);
      if (dataReceber.items) setReceivables(dataReceber.items);
      setExtratoStatement(dataExtrato.statement || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceiroData();
  }, [selectedMes, selectedAno]);

  // Submissão do novo título a pagar
  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/financeiro/contas-pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPayableForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackMsg({ type: "success", text: "Conta a pagar cadastrada com sucesso!" });
      setShowNewPayableModal(false);
      setNewPayableForm({
        descricao: "",
        fornecedorNome: "",
        fornecedorCpfCnpj: "",
        numeroDocumento: "",
        valorOriginal: "",
        dataVencimento: "",
        categoria: "GERAL",
      });
      loadFinanceiroData();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Erro ao salvar conta a pagar." });
    }
  };

  // Submissão da baixa
  const handleConfirmBaixa = async () => {
    if (!baixaModal.item) return;
    try {
      const endpoint =
        baixaModal.tipo === "PAGAR"
          ? `/api/financeiro/contas-pagar/${baixaModal.item.id}/baixar`
          : `/api/financeiro/contas-receber/${baixaModal.item.id}/baixar`;

      const payload =
        baixaModal.tipo === "PAGAR"
          ? {
              dataPagamento: baixaModal.data,
              valorPago: Number(baixaModal.valor),
              formaPagamento: baixaModal.forma,
            }
          : {
              dataRecebimento: baixaModal.data,
              valorRecebido: Number(baixaModal.valor),
              formaPagamento: baixaModal.forma,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackMsg({ type: "success", text: "Baixa registrada com sucesso!" });
      setBaixaModal({ ...baixaModal, open: false });
      loadFinanceiroData();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Erro ao registrar baixa." });
    }
  };

  // Upload dos 3 arquivos de extrato
  const handleUploadExtrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofxFile) {
      setFeedbackMsg({ type: "error", text: "Selecione ao menos o arquivo .ofx do Sicredi." });
      return;
    }

    setUploadingExtrato(true);
    try {
      const formData = new FormData();
      formData.append("ofxFile", ofxFile);
      if (txtFile) formData.append("txtFile", txtFile);
      if (pdfFile) formData.append("pdfFile", pdfFile);
      formData.append("mes", String(selectedMes));
      formData.append("ano", String(selectedAno));

      const res = await fetch("/api/financeiro/extratos", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExtratoStatement(data.statement);
      setFeedbackMsg({
        type: "success",
        text: `Extrato Sicredi importado com sucesso! ${data.totalTransacoes} transações processadas.`,
      });
      loadFinanceiroData();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Erro ao processar extrato." });
    } finally {
      setUploadingExtrato(false);
    }
  };

  // Disparo do e-mail de fechamento com o ZIP
  const handleSendClosingEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoEmail(true);
    try {
      const res = await fetch("/api/financeiro/fechamento/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatario: emailDestinatario,
          assunto: emailAssunto,
          mensagem: emailMensagem,
          mes: selectedMes,
          ano: selectedAno,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackMsg({
        type: "success",
        text: data.message || "E-mail de fechamento enviado com sucesso!",
      });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Erro ao enviar e-mail." });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Análise com IA de documento avulso
  const handleAnalyzeWithIA = async () => {
    if (!iaFile) return;
    setAnalyzingIa(true);
    setIaResult(null);

    try {
      const formData = new FormData();
      formData.append("file", iaFile);

      const res = await fetch("/api/financeiro/ia/analisar-arquivo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIaResult(data);
      setFeedbackMsg({
        type: "success",
        text: `Documento analisado com sucesso e classificado como: ${data.createdType}`,
      });
      loadFinanceiroData();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Erro na análise de IA." });
    } finally {
      setAnalyzingIa(false);
    }
  };

  // Totais rápidos
  const totalPagarPendente = payables
    .filter((p) => p.status === "PENDENTE" || p.status === "PARCIAL")
    .reduce((acc, p) => acc + (p.valorOriginal - p.valorPago), 0);

  const totalReceberPendente = receivables
    .filter((r) => r.status === "PENDENTE" || r.status === "PARCIAL")
    .reduce((acc, r) => acc + (r.valorOriginal - r.valorRecebido), 0);

  return (
    <div className="space-y-6">
      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Topo do Módulo Financeiro com Seletor de Competência */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0B3D91] text-white flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5 text-[#00A6FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Gestão Financeira & Conciliação
              </h1>
              <p className="text-xs text-muted-foreground">
                Contas a Pagar, Contas a Receber, Extrato Sicredi, Automação IA e Fechamento Mensal
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Competência Mês / Ano */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-border px-3 py-2 rounded-xl text-xs font-medium">
            <Calendar className="w-4 h-4 text-[#0B3D91]" />
            <span>Competência:</span>
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(Number(e.target.value))}
              className="bg-transparent font-bold focus:outline-none cursor-pointer"
            >
              {[
                "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedAno}
              onChange={(e) => setSelectedAno(Number(e.target.value))}
              className="bg-transparent font-bold focus:outline-none cursor-pointer"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cartões de Indicadores Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">A Pagar Pendente</span>
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2 font-mono">
            R$ {totalPagarPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {payables.filter((p) => p.status === "PENDENTE").length} títulos aguardando liquidação
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">A Receber Pendente</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
            R$ {totalReceberPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {receivables.filter((r) => r.status === "PENDENTE").length} títulos a receber no mês
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Sicredi OFX</span>
            <div className="w-8 h-8 rounded-lg bg-[#0B3D91]/10 text-[#0B3D91] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-foreground mt-2 font-mono">
            {extratoStatement ? `${extratoStatement.transacoes?.length || 0} Lançamentos` : "Não Importado"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Extrato bancário da competência
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Inteligência Artificial</span>
            <div className="w-8 h-8 rounded-lg bg-[#FF7A00]/10 text-[#FF7A00] flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-foreground mt-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#FF7A00]" />
            <span>Gemini Multimodal</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Classificação automática ativa
          </p>
        </div>
      </div>

      {/* Abas de Navegação do Módulo */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-1">
        {[
          { id: "pagar", label: "Contas a Pagar", icon: ArrowDownRight },
          { id: "receber", label: "Contas a Receber", icon: ArrowUpRight },
          { id: "extrato", label: "Extrato & Conciliação Sicredi", icon: FileSpreadsheet },
          { id: "fechamento", label: "Fechamento Mensal & Envio", icon: FolderArchive },
          { id: "ia", label: "Automação com IA", icon: Bot },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "border-[#0B3D91] text-[#0B3D91] font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: CONTAS A PAGAR */}
      {/* ========================================================================= */}
      {activeTab === "pagar" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Lançamentos de Contas a Pagar</h2>
            <button
              onClick={() => setShowNewPayableModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Pagamento</span>
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Conciliado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payables.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhum registro de conta a pagar para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    payables.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4 font-mono">
                          {new Date(p.dataVencimento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">{p.fornecedorNome}</td>
                        <td className="py-3 px-4 text-muted-foreground">{p.descricao}</td>
                        <td className="py-3 px-4 font-mono">{p.numeroDocumento || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-600">
                          R$ {p.valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === "PAGO"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : p.status === "PARCIAL"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.conciliado ? (
                            <span className="text-emerald-600 font-bold">Sim</span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {p.status !== "PAGO" && (
                            <button
                              onClick={() =>
                                setBaixaModal({
                                  open: true,
                                  tipo: "PAGAR",
                                  item: p,
                                  valor: String(p.valorOriginal - p.valorPago),
                                  data: new Date().toISOString().slice(0, 10),
                                  forma: "PIX",
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Dar Baixa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CONTAS A RECEBER */}
      {/* ========================================================================= */}
      {activeTab === "receber" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Lançamentos de Contas a Receber</h2>
            <a
              href="/nfse"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00A6FF] hover:bg-[#0091e0] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Emitir NFS-e Nacional</span>
            </a>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Cliente / Tomador</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Nº NF-e / NFS-e</th>
                    <th className="py-3 px-4 text-right">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Conciliado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receivables.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhum registro de conta a receber para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    receivables.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4 font-mono">
                          {new Date(r.dataVencimento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">{r.clienteNome}</td>
                        <td className="py-3 px-4 text-muted-foreground">{r.descricao}</td>
                        <td className="py-3 px-4 font-mono">
                          {r.numeroNf ? (
                            <span className="font-bold text-[#0B3D91]">{r.numeroNf}</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          R$ {r.valorOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === "RECEBIDO"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {r.conciliado ? (
                            <span className="text-emerald-600 font-bold">Sim</span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status !== "RECEBIDO" && (
                            <button
                              onClick={() =>
                                setBaixaModal({
                                  open: true,
                                  tipo: "RECEBER",
                                  item: r,
                                  valor: String(r.valorOriginal - r.valorRecebido),
                                  data: new Date().toISOString().slice(0, 10),
                                  forma: "PIX",
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Dar Baixa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: EXTRATO & CONCILIAÇÃO SICREDI (MODELO DO PRINT) */}
      {/* ========================================================================= */}
      {activeTab === "extrato" && (
        <div className="space-y-6">
          {/* Card de Importação dos 3 Arquivos */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xs">
            <h2 className="text-base font-bold text-foreground mb-1">
              Importação do Extrato Bancário Sicredi (3 Arquivos)
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Conforme exigido pelo processo contábil, anexe os 3 arquivos gerados pelo banco (OFX, TXT e PDF).
              O sistema armazenará os 3 na pasta de extrato do período e lerá os dados do arquivo <strong>.OFX</strong> para a conciliação.
            </p>

            <form onSubmit={handleUploadExtrato} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-dashed border-border rounded-xl p-4 text-center bg-slate-50 dark:bg-slate-900/40">
                <p className="text-xs font-bold text-[#0B3D91] uppercase">1. Arquivo .OFX (Obrigatório)</p>
                <input
                  type="file"
                  accept=".ofx"
                  required
                  onChange={(e) => setOfxFile(e.target.files?.[0] || null)}
                  className="mt-2 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-[#0B3D91] file:text-white cursor-pointer"
                />
              </div>

              <div className="border border-dashed border-border rounded-xl p-4 text-center bg-slate-50 dark:bg-slate-900/40">
                <p className="text-xs font-bold text-muted-foreground uppercase">2. Arquivo .TXT</p>
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => setTxtFile(e.target.files?.[0] || null)}
                  className="mt-2 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-slate-700 file:text-white cursor-pointer"
                />
              </div>

              <div className="border border-dashed border-border rounded-xl p-4 text-center bg-slate-50 dark:bg-slate-900/40">
                <p className="text-xs font-bold text-muted-foreground uppercase">3. Arquivo .PDF</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="mt-2 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-slate-700 file:text-white cursor-pointer"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={uploadingExtrato}
                  className="px-6 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white font-semibold text-xs flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {uploadingExtrato ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando OFX...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Importar Extrato e Conciliar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Visualização da Planilha Exatamente no Modelo do Print */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Planilha de Conciliação Bancária ({String(selectedMes).padStart(2, "0")}/{selectedAno})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Visualização fiel ao modelo com débitos destacados em vermelho e saldo da conta
                </p>
              </div>

              <a
                href={`/api/financeiro/conciliacao/exportar-excel?mes=${selectedMes}&ano=${selectedAno}`}
                download
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Planilha Excel Oficial (.xlsx)</span>
              </a>
            </div>

            {/* Tabela Idêntica ao Print */}
            <div className="border border-[#002060] rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  {/* Linha 1: Instruções em Azul Marinho Escuro */}
                  <thead>
                    <tr className="bg-[#002060] text-white text-[11px] font-bold text-center border-b border-white/20">
                      <th className="py-3 px-3 w-32 border-r border-white/20">
                        Inserir a Data que o fato ocorreu
                      </th>
                      <th className="py-3 px-3 w-28 border-r border-white/20">
                        Inserir o nº da NF se houver
                      </th>
                      <th className="py-3 px-4 border-r border-white/20 text-center">
                        Inserir breve descrição sobre o pagamento ou recebimento
                      </th>
                      <th className="py-3 px-4 w-44 border-r border-white/20 text-center">
                        Valor deve ser exatamente igual ao extrato bancario
                      </th>
                      <th className="py-3 px-4 w-44 text-center">
                        Saldo deve ser igual ao saldo da conta bancária
                      </th>
                    </tr>

                    {/* Linha 2: Cabeçalhos das Colunas */}
                    <tr className="bg-[#002060] text-white font-extrabold uppercase text-xs border-b border-slate-300">
                      <th className="py-2.5 px-3 text-center border-r border-white/20">DATA</th>
                      <th className="py-2.5 px-3 text-center border-r border-white/20">NF</th>
                      <th className="py-2.5 px-4 text-left border-r border-white/20">DESCRIÇÃO</th>
                      <th className="py-2.5 px-4 text-right border-r border-white/20">VALOR</th>
                      <th className="py-2.5 px-4 text-right">SALDO</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                    {/* Linha 3: Saldo Anterior */}
                    <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800"></td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800"></td>
                      <td className="py-2 px-4 border-r border-slate-200 dark:border-slate-800 font-sans uppercase">
                        SALDO ANTERIOR
                      </td>
                      <td className="py-2 px-4 border-r border-slate-200 dark:border-slate-800 text-right"></td>
                      <td className="py-2 px-4 text-right text-foreground">
                        R${(extratoStatement?.saldoInicial || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* Linhas das Transações */}
                    {extratoStatement?.transacoes && extratoStatement.transacoes.length > 0 ? (
                      extratoStatement.transacoes.map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                            {new Date(t.data).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800 font-sans">
                            {t.receivable?.numeroNf || t.payable?.numeroDocumento || t.numeroDocumento || ""}
                          </td>
                          <td className="py-2 px-4 border-r border-slate-200 dark:border-slate-800 font-sans text-foreground">
                            {t.descricao}
                          </td>
                          <td
                            className={`py-2 px-4 text-right border-r border-slate-200 dark:border-slate-800 font-bold ${
                              t.valor < 0 ? "text-red-600" : "text-foreground"
                            }`}
                          >
                            {t.valor < 0 ? "-" : ""}R${Math.abs(t.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-4 text-right text-foreground font-bold">
                            R${(t.saldo || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground font-sans">
                          Importe o arquivo .OFX acima para visualizar os dados de conciliação deste mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: FECHAMENTO MENSAL & ENVIO */}
      {/* ========================================================================= */}
      {activeTab === "fechamento" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Estrutura do Pacote ZIP */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Pacote de Fechamento Compactado (.ZIP)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Competência: {String(selectedMes).padStart(2, "0")}/{selectedAno}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border text-xs space-y-2 font-mono">
              <p className="font-bold text-[#0B3D91] flex items-center gap-1.5 font-sans">
                <FolderArchive className="w-4 h-4" />
                <span>Fechamento_APAA_{selectedAno}_{String(selectedMes).padStart(2, "0")}.zip</span>
              </p>
              <div className="pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                <p>📄 Conciliacao_Bancaria_{selectedAno}_{String(selectedMes).padStart(2, "0")}.xlsx</p>
                <p>📁 Extrato/ (Arquivos .ofx, .txt, .pdf do Sicredi)</p>
                <p>📁 NFs emitidas/ (Notas Fiscais de receitas a receber)</p>
                <p>📁 Boletos e NFs a pagar/ (Boletos e notas de despesas)</p>
                <p>📁 Comprovantes/ (Comprovantes de liquidação bancária)</p>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={`/api/financeiro/fechamento/zip?mes=${selectedMes}&ano=${selectedAno}`}
                download
                className="w-full py-3 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Arquivo .ZIP do Período</span>
              </a>
            </div>
          </div>

          {/* Formulário de Envio de E-mail */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Enviar Fechamento por E-mail
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remetente: <strong>{user.email}</strong> ({user.name})
              </p>
            </div>

            <form onSubmit={handleSendClosingEmail} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  E-mail do Destinatário (ex: Contabilidade)
                </label>
                <input
                  type="email"
                  required
                  placeholder="contabilidade@escritorio.com.br"
                  value={emailDestinatario}
                  onChange={(e) => setEmailDestinatario(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Assunto
                </label>
                <input
                  type="text"
                  placeholder={`Fechamento Financeiro APAA - ${String(selectedMes).padStart(2, "0")}/${selectedAno}`}
                  value={emailAssunto}
                  onChange={(e) => setEmailAssunto(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Mensagem Adicional
                </label>
                <textarea
                  rows={3}
                  placeholder="Olá, segue em anexo o fechamento bancário e contábil deste mês."
                  value={emailMensagem}
                  onChange={(e) => setEmailMensagem(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={enviandoEmail}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Empacotando e enviando e-mail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar E-mail com Pacote .ZIP Anexado</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: AUTOMAÇÃO COM IA (GEMINI MULTIMODAL) */}
      {/* ========================================================================= */}
      {activeTab === "ia" && (
        <div className="space-y-6">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Leitura e Classificação Inteligente com IA (Gemini)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Envie qualquer boleto, nota fiscal (PDF, imagem, XML) ou comprovante bancário. A IA reconhecerá o pagador/recebedor pelo CNPJ e efetuará o lançamento ou a baixa automaticamente.
                </p>
              </div>
            </div>

            <div className="mt-4 p-6 border-2 border-dashed border-border rounded-2xl text-center bg-slate-50 dark:bg-slate-900/40">
              <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">
                Selecione ou arraste o arquivo do documento
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Formatos aceitos: PDF, Imagens (PNG, JPG), XML (NF-e/NFS-e)
              </p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xml"
                onChange={(e) => setIaFile(e.target.files?.[0] || null)}
                className="mt-4 text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-[#0B3D91] file:text-white cursor-pointer"
              />

              {iaFile && (
                <div className="mt-4">
                  <button
                    onClick={handleAnalyzeWithIA}
                    disabled={analyzingIa}
                    className="px-6 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e06b00] text-white font-semibold text-xs flex items-center gap-2 mx-auto shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {analyzingIa ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>A Inteligência Artificial está lendo o documento...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4" />
                        <span>Analisar e Lançar com IA</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Resultado da Análise */}
            {iaResult && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border text-xs space-y-2">
                <p className="font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Documento Processado com Sucesso!</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-foreground">
                  <div>
                    <span className="font-semibold text-muted-foreground">Tipo Identificado:</span>{" "}
                    {iaResult.analysis?.tipoDocumento}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Valor Extraído:</span> R${" "}
                    {iaResult.analysis?.valor?.toFixed(2)}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Pagador:</span>{" "}
                    {iaResult.analysis?.nomePagador || iaResult.analysis?.cnpjPagador || "Não informado"}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Beneficiário:</span>{" "}
                    {iaResult.analysis?.nomeRecebedor || iaResult.analysis?.cnpjRecebedor || "Não informado"}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-semibold text-muted-foreground">Ação Realizada pelo App:</span>{" "}
                    <span className="font-bold text-[#0B3D91]">{iaResult.createdType}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO CONTAS A PAGAR */}
      {/* ========================================================================= */}
      {showNewPayableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-foreground mb-4">Novo Título a Pagar</h3>
            <form onSubmit={handleCreatePayable} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Fornecedor</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do fornecedor ou empresa"
                  value={newPayableForm.fornecedorNome}
                  onChange={(e) => setNewPayableForm({ ...newPayableForm, fornecedorNome: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Assinatura de Software, Aluguel, etc."
                  value={newPayableForm.descricao}
                  onChange={(e) => setNewPayableForm({ ...newPayableForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newPayableForm.valorOriginal}
                    onChange={(e) => setNewPayableForm({ ...newPayableForm, valorOriginal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={newPayableForm.dataVencimento}
                    onChange={(e) => setNewPayableForm({ ...newPayableForm, dataVencimento: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Nº Documento / NF</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={newPayableForm.numeroDocumento}
                    onChange={(e) => setNewPayableForm({ ...newPayableForm, numeroDocumento: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">CNPJ / CPF</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={newPayableForm.fornecedorCpfCnpj}
                    onChange={(e) => setNewPayableForm({ ...newPayableForm, fornecedorCpfCnpj: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewPayableModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0B3D91] text-white font-semibold shadow-sm hover:bg-[#082e6e] cursor-pointer"
                >
                  Salvar Título
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR BAIXA */}
      {/* ========================================================================= */}
      {baixaModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Registrar Baixa de {baixaModal.tipo === "PAGAR" ? "Pagamento" : "Recebimento"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {baixaModal.item?.descricao} (Total original: R${" "}
              {baixaModal.item?.valorOriginal?.toFixed(2)})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Valor Efetivo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={baixaModal.valor}
                  onChange={(e) => setBaixaModal({ ...baixaModal, valor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono font-bold focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Data da Liquidação</label>
                <input
                  type="date"
                  value={baixaModal.data}
                  onChange={(e) => setBaixaModal({ ...baixaModal, data: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Forma de Pagamento</label>
                <select
                  value={baixaModal.forma}
                  onChange={(e) => setBaixaModal({ ...baixaModal, forma: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none cursor-pointer"
                >
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto Bancário</option>
                  <option value="DEBITO_CONTA">Débito em Conta (Sicredi)</option>
                  <option value="TED">TED / Transferência</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBaixaModal({ ...baixaModal, open: false })}
                  className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBaixa}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
                >
                  Confirmar Baixa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

