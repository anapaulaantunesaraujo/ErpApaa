"use client";

import { useState, useEffect } from "react";
import type { SessionUser } from "@/lib/auth";
import {
  ReceiptText,
  FileText,
  Settings2,
  Plus,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Coins,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Ban,
  History,
  FileCheck,
  XCircle,
  FileX2,
} from "lucide-react";

export default function NfseClient({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<"emitir" | "historico" | "catalogo">("emitir");

  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal e Ação de Cancelamento Oficial no Ambiente Nacional
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [notaParaCancelar, setNotaParaCancelar] = useState<any | null>(null);
  const [codigoMotivoCancelamento, setCodigoMotivoCancelamento] = useState("1");
  const [justificativaCancelamento, setJustificativaCancelamento] = useState("");
  const [cancelando, setCancelando] = useState(false);

  // Formulário de Emissão Rápida
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [selectedServicoId, setSelectedServicoId] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [dataVencimento, setDataVencimento] = useState("");
  const [discriminacaoAdicional, setDiscriminacaoAdicional] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [emissaoSucesso, setEmissaoSucesso] = useState<any>(null);

  // Modal para cadastro rápido de novo cliente
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [newClienteForm, setNewClienteForm] = useState({
    nome: "",
    cpfCnpj: "",
    email: "",
    cidade: "",
    uf: "",
  });

  // Modal para cadastro de novo serviço fiscal
  const [showServicoModal, setShowServicoModal] = useState(false);
  const [newServicoForm, setNewServicoForm] = useState({
    codigo: "",
    descricao: "",
    cnae: "",
    codigoTributacaoNacional: "",
    aliquotaIss: "",
    retencaoIss: false,
    valorPadrao: "",
  });

  const loadNotas = async () => {
    setLoadingNotas(true);
    try {
      const res = await fetch("/api/fiscal/nfse");
      const data = await res.json();
      if (data.items) setNotas(data.items);
    } catch (err) {
      console.error("Erro ao carregar notas emitidas:", err);
    } finally {
      setLoadingNotas(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [resClientes, resServicos] = await Promise.all([
        fetch("/api/cadastros/clientes"),
        fetch("/api/fiscal/servicos"),
      ]);

      const dataClientes = await resClientes.json();
      const dataServicos = await resServicos.json();

      if (dataClientes.items) setClientes(dataClientes.items);
      if (dataServicos.items) {
        setServicos(dataServicos.items);
        if (dataServicos.items.length > 0 && !selectedServicoId) {
          setSelectedServicoId(dataServicos.items[0].id);
          if (dataServicos.items[0].valorPadrao) {
            setValorUnitario(String(dataServicos.items[0].valorPadrao));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadNotas();
    // Default vencimento para 15 dias no futuro
    const defaultVenc = new Date(Date.now() + 15 * 86400000);
    setDataVencimento(defaultVenc.toISOString().slice(0, 10));
  }, []);

  const handleAbrirCancelamento = (nota: any) => {
    setNotaParaCancelar(nota);
    setCodigoMotivoCancelamento("1");
    setJustificativaCancelamento("");
    setShowCancelarModal(true);
  };

  const handleConfirmarCancelamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notaParaCancelar) return;

    if (justificativaCancelamento.trim().length < 15) {
      setFeedback({
        type: "error",
        text: "A justificativa legal deve ter pelo menos 15 caracteres (exigência da Receita Federal).",
      });
      return;
    }

    setCancelando(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/fiscal/nfse/${notaParaCancelar.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoMotivo: codigoMotivoCancelamento,
          justificativa: justificativaCancelamento.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({
        type: "success",
        text: `NFS-e Nº ${notaParaCancelar.numeroNfse} cancelada com sucesso no Ambiente Nacional (Protocolo: ${data.protocolo}). O Contas a Receber vinculado foi cancelado automaticamente.`,
      });
      setShowCancelarModal(false);
      setNotaParaCancelar(null);
      loadNotas();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Erro ao processar cancelamento no Ambiente Nacional.",
      });
    } finally {
      setCancelando(false);
    }
  };

  // Ao selecionar outro serviço, puxa o valor padrão se existir
  const handleSelectServico = (servicoId: string) => {
    setSelectedServicoId(servicoId);
    const s = servicos.find((srv) => srv.id === servicoId);
    if (s && s.valorPadrao) {
      setValorUnitario(String(s.valorPadrao));
    }
  };

  // Serviço selecionado atual
  const currentServico = servicos.find((s) => s.id === selectedServicoId);

  // Cálculos dinâmicos em tela
  const qtdNum = Number(quantidade) || 1;
  const vUnitNum = Number(valorUnitario) || 0;
  const vTotalCalculado = vUnitNum * qtdNum;
  const aliquotaIssAtual = currentServico ? currentServico.aliquotaIss : 2.0;
  const valorIssCalculado = (vTotalCalculado * aliquotaIssAtual) / 100;
  const issRetidoAtual = currentServico ? currentServico.retencaoIss : false;
  const valorLiquidoCalculado = vTotalCalculado - (issRetidoAtual ? valorIssCalculado : 0);

  // Submissão da Emissão da NFS-e Nacional
  const handleEmitirNfse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !selectedServicoId || !vUnitNum) {
      setFeedback({ type: "error", text: "Selecione o cliente, o serviço e informe o valor." });
      return;
    }

    setEmitindo(true);
    setEmissaoSucesso(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/fiscal/nfse/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: selectedClienteId,
          servicoId: selectedServicoId,
          valorUnitario: vUnitNum,
          quantidade: qtdNum,
          valorTotal: vTotalCalculado,
          dataVencimento,
          discriminacaoAdicional,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEmissaoSucesso(data);
      loadNotas();
      setFeedback({
        type: "success",
        text: `NFS-e Nº ${data.nfse?.numeroNfse} emitida com sucesso e lançada em Contas a Receber!`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Erro ao emitir NFS-e." });
    } finally {
      setEmitindo(false);
    }
  };

  // Salvar novo cliente rápido
  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/cadastros/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClienteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowClienteModal(false);
      setFeedback({ type: "success", text: "Cliente cadastrado com sucesso!" });
      loadData();
      if (data.item) setSelectedClienteId(data.item.id);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Erro ao salvar cliente." });
    }
  };

  // Salvar novo serviço fiscal
  const handleSaveServico = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/fiscal/servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newServicoForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowServicoModal(false);
      setFeedback({ type: "success", text: "Serviço fiscal cadastrado com sucesso!" });
      loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Erro ao cadastrar serviço." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-semibold hover:underline">
            Fechar
          </button>
        </div>
      )}

      {/* Topo do Emissor Fiscal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A6FF] text-white flex items-center justify-center shadow-sm">
            <ReceiptText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Emissor NFS-e Nacional 2026
            </h1>
            <p className="text-xs text-muted-foreground">
              Emissão simplificada integrada ao Ambiente Nacional (Receita Federal) com lançamento automático em Contas a Receber
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("emitir")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "emitir"
                ? "bg-[#0B3D91] text-white shadow-xs"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Emitir NFS-e Rápida
          </button>
          <button
            onClick={() => {
              setActiveTab("historico");
              loadNotas();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "historico"
                ? "bg-[#0B3D91] text-white shadow-xs"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Notas Emitidas & Cancelamento</span>
            {notas.length > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === "historico" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {notas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("catalogo")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "catalogo"
                ? "bg-[#0B3D91] text-white shadow-xs"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Serviços & Regras Tributárias
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: EMISSÃO RÁPIDA DE NFS-E */}
      {/* ========================================================================= */}
      {activeTab === "emitir" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário Principal de Emissão */}
          <div className="lg:col-span-2 bg-card border border-border p-6 rounded-2xl shadow-xs space-y-5">
            <h2 className="text-base font-bold text-foreground">
              Preenchimento Simplificado da NFS-e
            </h2>
            <p className="text-xs text-muted-foreground">
              Basta selecionar o cliente pagador, o serviço e os valores. Todos os demais dados tributários (CNAE, Código de Tributação Nacional, Alíquota de ISS e Retenções) são preenchidos automaticamente.
            </p>

            <form onSubmit={handleEmitirNfse} className="space-y-4 text-xs">
              {/* Seleção do Cliente */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-muted-foreground uppercase">
                    1. Cliente / Tomador dos Serviços
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowClienteModal(true)}
                    className="text-[#00A6FF] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cadastrar Novo Cliente</span>
                  </button>
                </div>
                <select
                  required
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-[#00A6FF] outline-none cursor-pointer"
                >
                  <option value="">Selecione o cliente tomador...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.cpfCnpj})
                    </option>
                  ))}
                </select>
              </div>

              {/* Seleção do Serviço Pré-configurado */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-muted-foreground uppercase">
                    2. Serviço Prestado (Catálogo Tributário)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab("catalogo")}
                    className="text-[#0B3D91] font-bold hover:underline cursor-pointer"
                  >
                    Gerenciar Regras Fiscais
                  </button>
                </div>
                <select
                  required
                  value={selectedServicoId}
                  onChange={(e) => handleSelectServico(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-[#00A6FF] outline-none cursor-pointer"
                >
                  {servicos.length === 0 ? (
                    <option value="">Nenhum serviço cadastrado ainda</option>
                  ) : (
                    servicos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.descricao} (CNAE: {s.cnae} | Tributação: {s.codigoTributacaoNacional})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Valores e Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground uppercase mb-1">
                    Valor Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={valorUnitario}
                    onChange={(e) => setValorUnitario(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono font-bold focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground uppercase mb-1">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground uppercase mb-1">
                    Vencimento a Receber
                  </label>
                  <input
                    type="date"
                    required
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
              </div>

              {/* Discriminação Adicional */}
              <div>
                <label className="block font-semibold text-muted-foreground uppercase mb-1">
                  Detalhes / Discriminação Complementar (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Treinamento executivo turma 04 realizado no período de 10 a 20 de outubro."
                  value={discriminacaoAdicional}
                  onChange={(e) => setDiscriminacaoAdicional(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              {/* Botão de Transmissão */}
              <button
                type="submit"
                disabled={emitindo || !vUnitNum}
                className="w-full py-3.5 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {emitindo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transmitindo NFS-e ao Ambiente Nacional e criando Contas a Receber...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#00A6FF]" />
                    <span>Emitir NFS-e Nacional e Lançar no Contas a Receber</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Painel Lateral: Resumo Tributário Preenchido Automaticamente */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0B3D91]" />
              <span>Resumo Fiscal Automático (2026)</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Total dos Serviços:</span>
                <span className="font-mono font-bold text-foreground">
                  R$ {vTotalCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNAE Vinculado:</span>
                <span className="font-mono font-semibold text-foreground">
                  {currentServico?.cnae || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cód. Tributação Nacional:</span>
                <span className="font-mono font-semibold text-foreground">
                  {currentServico?.codigoTributacaoNacional || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alíquota ISS:</span>
                <span className="font-mono font-semibold text-foreground">
                  {aliquotaIssAtual}% ({issRetidoAtual ? "Retido pelo tomador" : "Não retido"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor do ISS:</span>
                <span className="font-mono font-semibold text-foreground">
                  R$ {valorIssCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between font-bold text-sm">
                <span className="text-foreground">Valor Líquido a Receber:</span>
                <span className="font-mono text-emerald-600">
                  R$ {valorLiquidoCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Sucesso da Emissão */}
            {emissaoSucesso && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs space-y-2 text-emerald-900 dark:text-emerald-200">
                <p className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>NFS-e Nacional Emitida com Sucesso!</span>
                </p>
                <p>
                  <strong>Nº da Nota:</strong> {emissaoSucesso.nfse?.numeroNfse}
                </p>
                <p className="font-mono text-[10px] break-all">
                  <strong>Chave:</strong> {emissaoSucesso.nfse?.chaveAcesso}
                </p>
                <p className="pt-1 text-slate-600 dark:text-slate-300">
                  ✅ Título de <strong>R$ {emissaoSucesso.receivable?.valorOriginal?.toFixed(2)}</strong> lançado em <strong>Contas a Receber</strong> com status <strong>PENDENTE</strong>.
                </p>
                <div className="pt-2">
                  <a
                    href="/financeiro"
                    className="inline-flex items-center gap-1 font-bold text-[#0B3D91] hover:underline"
                  >
                    <span>Ver no Contas a Receber</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: NOTAS EMITIDAS & CANCELAMENTO OFICIAL */}
      {/* ========================================================================= */}
      {activeTab === "historico" && (
        <div className="space-y-6">
          {/* Métricas do Histórico Fiscal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase">Notas Homologadas</span>
              <p className="text-2xl font-bold text-foreground mt-1">
                {notas.filter((n) => n.status !== "CANCELADA").length}
              </p>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Válidas no Ambiente Nacional
              </span>
            </div>

            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase">Valor Ativo Emitido</span>
              <p className="text-2xl font-bold text-emerald-600 font-mono mt-1">
                R${" "}
                {notas
                  .filter((n) => n.status !== "CANCELADA")
                  .reduce((acc, n) => acc + (n.valorLiquido || n.valorServico || 0), 0)
                  .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-muted-foreground">Títulos a receber / baixados</span>
            </div>

            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase">Notas Canceladas</span>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {notas.filter((n) => n.status === "CANCELADA").length}
              </p>
              <span className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-1">
                <Ban className="w-3.5 h-3.5" />
                Oficialmente anuladas
              </span>
            </div>

            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase">Valor Cancelado</span>
              <p className="text-2xl font-bold text-slate-500 font-mono mt-1">
                R${" "}
                {notas
                  .filter((n) => n.status === "CANCELADA")
                  .reduce((acc, n) => acc + (n.valorLiquido || n.valorServico || 0), 0)
                  .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-muted-foreground">Isento de cobrança fiscal</span>
            </div>
          </div>

          {/* Tabela de Notas Fiscais */}
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-[#0B3D91]" />
                  <span>Histórico de Emissões & Cancelamentos</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Notas Fiscais de Serviços emitidas no padrão nacional. Cancelamentos são transmitidos com protocolo legal ao CGNFSE.
                </p>
              </div>

              <button
                onClick={() => setActiveTab("emitir")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Emissão</span>
              </button>
            </div>

            {loadingNotas ? (
              <div className="p-12 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#00A6FF]" />
                <p className="text-xs">Consultando notas fiscais no sistema...</p>
              </div>
            ) : notas.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FileX2 className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">Nenhuma NFS-e emitida ainda</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Assim que você emitir sua primeira NFS-e, ela aparecerá aqui com os dados de transmissão, DANFSE e opção de cancelamento.
                </p>
                <button
                  onClick={() => setActiveTab("emitir")}
                  className="px-4 py-2 rounded-xl bg-[#0B3D91] text-white text-xs font-semibold shadow-xs hover:bg-[#082e6e] cursor-pointer"
                >
                  Emitir Primeira NFS-e
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Nº / Chave NFS-e</th>
                      <th className="py-3 px-4">Data Emissão</th>
                      <th className="py-3 px-4">Tomador (Cliente)</th>
                      <th className="py-3 px-4">Serviço / CNAE</th>
                      <th className="py-3 px-4 text-right">Valor Líquido</th>
                      <th className="py-3 px-4 text-center">Status Fiscal</th>
                      <th className="py-3 px-4 text-center">Contas a Receber</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {notas.map((nota) => {
                      const isCancelada = nota.status === "CANCELADA";
                      const dtEmissao = new Date(nota.dataEmissao).toLocaleDateString("pt-BR");
                      const dtCancelamento = nota.dataCancelamento
                        ? new Date(nota.dataCancelamento).toLocaleDateString("pt-BR")
                        : null;

                      return (
                        <tr
                          key={nota.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isCancelada ? "opacity-75 bg-red-50/20 dark:bg-red-950/10" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>NFS-e Nº {nota.numeroNfse || "—"}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={nota.chaveAcesso}>
                              {nota.chaveAcesso ? `${nota.chaveAcesso.slice(0, 14)}...` : `DPS ${nota.numeroDps}`}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            <span>{dtEmissao}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-foreground">{nota.cliente?.nome || "Cliente"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {nota.cliente?.cpfCnpj || "CPF/CNPJ não informado"}
                            </p>
                          </td>

                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-foreground line-clamp-1">
                              {nota.servico?.descricao || nota.discriminacao}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              CNAE: {nota.servico?.cnae || "85.99-6-99"} • Trib: {nota.servico?.codigoTributacaoNacional || "08.02.01"}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono">
                            <span className={`font-bold ${isCancelada ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              R${" "}
                              {(nota.valorLiquido || nota.valorServico).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            {nota.issRetido && (
                              <p className="text-[10px] text-amber-600">ISS Retido na fonte</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isCancelada ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                                  <Ban className="w-3 h-3" />
                                  <span>Cancelada</span>
                                </span>
                                {nota.protocoloCancelamento && (
                                  <p
                                    className="text-[9px] text-muted-foreground font-mono truncate max-w-[120px] mx-auto"
                                    title={`Protocolo Nacional: ${nota.protocoloCancelamento} • Em: ${dtCancelamento} • Motivo: ${nota.motivoCancelamento}`}
                                  >
                                    Prot: {nota.protocoloCancelamento}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Homologada</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isCancelada ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                <XCircle className="w-3 h-3" />
                                <span>Anulado</span>
                              </span>
                            ) : nota.receivable?.status === "RECEBIDO" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Baixado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <span>Pendente</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {nota.linkDanfse && (
                                <a
                                  href={nota.linkDanfse}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  title="Visualizar DANFSE no Portal Nacional"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {!isCancelada ? (
                                <button
                                  onClick={() => handleAbrirCancelamento(nota)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-semibold cursor-pointer transition-colors"
                                  title="Cancelar NFS-e no Ambiente Nacional (Evento 101101)"
                                >
                                  <Ban className="w-3.5 h-3.5 text-red-600" />
                                  <span>Cancelar</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic px-2">
                                  Anulada
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === "catalogo" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Catálogo de Serviços Prestados & Regras Fiscais
              </h2>
              <p className="text-xs text-muted-foreground">
                Cadastre aqui os serviços que a APAA Treinamento presta. Na hora de emitir a nota, o sistema puxa automaticamente os CNAEs, alíquotas e códigos fiscais.
              </p>
            </div>
            <button
              onClick={() => setShowServicoModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white text-xs font-semibold shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Serviço Fiscal</span>
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Descrição do Serviço</th>
                    <th className="py-3 px-4">CNAE</th>
                    <th className="py-3 px-4">Cód. Tributação Nacional</th>
                    <th className="py-3 px-4 text-center">Alíquota ISS</th>
                    <th className="py-3 px-4 text-center">ISS Retido</th>
                    <th className="py-3 px-4 text-right">Valor Padrão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {servicos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nenhum serviço fiscal cadastrado. Clique no botão acima para adicionar.
                      </td>
                    </tr>
                  ) : (
                    servicos.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4 font-mono font-bold text-[#0B3D91]">{s.codigo || "-"}</td>
                        <td className="py-3 px-4 font-semibold text-foreground">{s.descricao}</td>
                        <td className="py-3 px-4 font-mono">{s.cnae}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {s.codigoTributacaoNacional}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{s.aliquotaIss}%</td>
                        <td className="py-3 px-4 text-center">
                          {s.retencaoIss ? (
                            <span className="text-amber-600 font-bold">Sim</span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                          {s.valorPadrao ? `R$ ${s.valorPadrao.toFixed(2)}` : "-"}
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
      {/* MODAL: NOVO CLIENTE */}
      {/* ========================================================================= */}
      {showClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-foreground">Cadastrar Novo Cliente Tomador</h3>
            <form onSubmit={handleSaveCliente} className="space-y-3">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Razão Social / Nome</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do cliente ou empresa tomadora"
                  value={newClienteForm.nome}
                  onChange={(e) => setNewClienteForm({ ...newClienteForm, nome: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">CNPJ ou CPF</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0000-00"
                  value={newClienteForm.cpfCnpj}
                  onChange={(e) => setNewClienteForm({ ...newClienteForm, cpfCnpj: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Cidade</label>
                  <input
                    type="text"
                    value={newClienteForm.cidade}
                    onChange={(e) => setNewClienteForm({ ...newClienteForm, cidade: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newClienteForm.uf}
                    onChange={(e) => setNewClienteForm({ ...newClienteForm, uf: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background uppercase font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">E-mail para Envio da Nota</label>
                <input
                  type="email"
                  placeholder="financeiro@cliente.com.br"
                  value={newClienteForm.email}
                  onChange={(e) => setNewClienteForm({ ...newClienteForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClienteModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0B3D91] text-white font-semibold shadow-sm hover:bg-[#082e6e] cursor-pointer"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO SERVIÇO FISCAL */}
      {/* ========================================================================= */}
      {showServicoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-foreground">Novo Serviço & Regras Tributárias</h3>
            <form onSubmit={handleSaveServico} className="space-y-3">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Descrição do Serviço</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Treinamento em desenvolvimento profissional e gerencial"
                  value={newServicoForm.descricao}
                  onChange={(e) => setNewServicoForm({ ...newServicoForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">CNAE</label>
                  <input
                    type="text"
                    required
                    placeholder="8599-6/04"
                    value={newServicoForm.cnae}
                    onChange={(e) => setNewServicoForm({ ...newServicoForm, cnae: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Cód. Tributação Nacional</label>
                  <input
                    type="text"
                    required
                    placeholder="08.02.01"
                    value={newServicoForm.codigoTributacaoNacional}
                    onChange={(e) => setNewServicoForm({ ...newServicoForm, codigoTributacaoNacional: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Alíquota ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newServicoForm.aliquotaIss}
                    onChange={(e) => setNewServicoForm({ ...newServicoForm, aliquotaIss: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Valor Padrão Sugerido</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Opcional"
                    value={newServicoForm.valorPadrao}
                    onChange={(e) => setNewServicoForm({ ...newServicoForm, valorPadrao: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkRetencao"
                  checked={newServicoForm.retencaoIss}
                  onChange={(e) => setNewServicoForm({ ...newServicoForm, retencaoIss: e.target.checked })}
                  className="rounded border-border text-[#0B3D91] cursor-pointer"
                />
                <label htmlFor="chkRetencao" className="font-semibold text-foreground cursor-pointer">
                  ISS com Retenção na Fonte (Tomador paga o imposto)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowServicoModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0B3D91] text-white font-semibold shadow-sm hover:bg-[#082e6e] cursor-pointer"
                >
                  Salvar Serviço Fiscal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCELAMENTO OFICIAL DE NFS-E NO AMBIENTE NACIONAL */}
      {/* ========================================================================= */}
      {showCancelarModal && notaParaCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Cancelar NFS-e no Ambiente Nacional
                </h3>
                <p className="text-muted-foreground text-xs">
                  NFS-e Nº <strong>{notaParaCancelar.numeroNfse}</strong> • Tomador: <strong>{notaParaCancelar.cliente?.nome}</strong>
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Atenção: Cancelamento Irrevogável (Evento 101101)</span>
              </p>
              <p>
                Este cancelamento será registrado e homologado no Ambiente Nacional da NFS-e (Receita Federal / CGNFSE).
              </p>
              <p>
                O título de <strong>R$ {(notaParaCancelar.valorLiquido || notaParaCancelar.valorServico).toFixed(2)}</strong> lançado em <strong>Contas a Receber</strong> será automaticamente <strong>anulado</strong>.
              </p>
            </div>

            <form onSubmit={handleConfirmarCancelamento} className="space-y-3">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Código do Motivo (Padrão Nacional CGNFSE)
                </label>
                <select
                  value={codigoMotivoCancelamento}
                  onChange={(e) => setCodigoMotivoCancelamento(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background font-semibold focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                >
                  <option value="1">1 - Erro na Emissão</option>
                  <option value="2">2 - Serviço não Prestado</option>
                  <option value="3">3 - Duplicidade da Nota Fiscal</option>
                  <option value="9">9 - Outros Motivos Legais</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-muted-foreground">
                    Justificativa Legal do Cancelamento (Mínimo 15 caracteres)
                  </label>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      justificativaCancelamento.trim().length >= 15
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {justificativaCancelamento.trim().length}/15 caracteres
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva detalhadamente o motivo que fundamenta o cancelamento fiscal oficial..."
                  value={justificativaCancelamento}
                  onChange={(e) => setJustificativaCancelamento(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={cancelando}
                  onClick={() => {
                    setShowCancelarModal(false);
                    setNotaParaCancelar(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={cancelando || justificativaCancelamento.trim().length < 15}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {cancelando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transmitindo ao Amb. Nacional...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Confirmar Cancelamento Oficial</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

