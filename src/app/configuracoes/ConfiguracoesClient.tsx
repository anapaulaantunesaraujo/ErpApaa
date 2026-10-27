"use client";

import { useState, useEffect } from "react";
import type { SessionUser } from "@/lib/auth";
import {
  Settings,
  Building2,
  Mail,
  Bot,
  Landmark,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function ConfiguracoesClient({ user }: { user: SessionUser }) {
  const [form, setForm] = useState({
    razaoSocial: "50.756.275 ANA PAULA ANTUNES ARAUJO",
    nomeFantasia: "APAA CONSULTORIA",
    cnpj: "50.756.275/0001-28",
    inscricaoMunicipal: "",
    porte: "ME",
    naturezaJuridica: "213-5 - Empresário (Individual)",
    cnaePrincipal: "85.99-6-99",
    cnaeDescricao: "Outras atividades de ensino não especificadas anteriormente",
    regimeTributario: "SIMPLES_NACIONAL",
    optanteSimples: true,
    aliquotaIssPadrao: 2.0,
    logradouro: "R VEREADOR TELEMACO DE OLIVEIRA",
    numero: "672",
    complemento: "",
    bairro: "CORDEIROS",
    cidade: "ITAJAI",
    uf: "SC",
    cep: "88.311-200",
    telefone: "(47) 9233-9005",
    email: "ANAPAULA.ANTUNESARAUJO@GMAIL.COM",
    emailFinanceiro: "ana.antunes@apaatreinamento.net.br",
    emailHost: "",
    emailPort: 993,
    emailUser: "",
    emailPass: "",
    emailFolder: "INBOX",
    geminiApiKey: "",
    agenciaSicredi: "",
    contaSicredi: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/configuracoes")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setForm({
            razaoSocial: data.settings.razaoSocial || "50.756.275 ANA PAULA ANTUNES ARAUJO",
            nomeFantasia: data.settings.nomeFantasia || "APAA CONSULTORIA",
            cnpj: data.settings.cnpj || "50.756.275/0001-28",
            inscricaoMunicipal: data.settings.inscricaoMunicipal || "",
            porte: data.settings.porte || "ME",
            naturezaJuridica: data.settings.naturezaJuridica || "213-5 - Empresário (Individual)",
            cnaePrincipal: data.settings.cnaePrincipal || "85.99-6-99",
            cnaeDescricao: data.settings.cnaeDescricao || "Outras atividades de ensino não especificadas anteriormente",
            regimeTributario: data.settings.regimeTributario || "SIMPLES_NACIONAL",
            optanteSimples: data.settings.optanteSimples ?? true,
            aliquotaIssPadrao: data.settings.aliquotaIssPadrao || 2.0,
            logradouro: data.settings.logradouro || "R VEREADOR TELEMACO DE OLIVEIRA",
            numero: data.settings.numero || "672",
            complemento: data.settings.complemento || "",
            bairro: data.settings.bairro || "CORDEIROS",
            cidade: data.settings.cidade || "ITAJAI",
            uf: data.settings.uf || "SC",
            cep: data.settings.cep || "88.311-200",
            telefone: data.settings.telefone || "(47) 9233-9005",
            email: data.settings.email || "ANAPAULA.ANTUNESARAUJO@GMAIL.COM",
            emailFinanceiro: data.settings.emailFinanceiro || "ana.antunes@apaatreinamento.net.br",
            emailHost: data.settings.emailHost || "",
            emailPort: data.settings.emailPort || 993,
            emailUser: data.settings.emailUser || "",
            emailPass: data.settings.emailPass || "",
            emailFolder: data.settings.emailFolder || "INBOX",
            geminiApiKey: data.settings.geminiApiKey || "",
            agenciaSicredi: data.settings.agenciaSicredi || "",
            contaSicredi: data.settings.contaSicredi || "",
          });
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/configuracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: "success", text: "Configurações da empresa salvas com sucesso!" });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Erro ao salvar configurações." });
    } finally {
      setSaving(false);
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

      {/* Topo */}
      <div className="flex items-center gap-3 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-[#0B3D91] text-white flex items-center justify-center shadow-sm">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurações da Empresa & Integrações
          </h1>
          <p className="text-xs text-muted-foreground">
            Cadastre o CNPJ oficial, conta Sicredi, e-mail monitorado para automação e chave da IA
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Bloco 1: Dados Cadastrais e Fiscais */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0B3D91]" />
            <span>Dados da Empresa (APAA Treinamento)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Razão Social</label>
              <input
                type="text"
                required
                value={form.razaoSocial}
                onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Nome Fantasia</label>
              <input
                type="text"
                value={form.nomeFantasia}
                onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0B3D91] uppercase mb-1">
                CNPJ da Empresa (Usado na IA para definir Pagador/Recebedor)
              </label>
              <input
                type="text"
                required
                placeholder="00.000.000/0001-00"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#0B3D91]/40 bg-background font-mono font-bold focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Inscrição Municipal</label>
              <input
                type="text"
                value={form.inscricaoMunicipal}
                onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Regime Tributário</label>
              <select
                value={form.regimeTributario}
                onChange={(e) => setForm({ ...form, regimeTributario: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none cursor-pointer"
              >
                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                <option value="LUCRO_REAL">Lucro Real</option>
                <option value="MEI">Microempreendedor Individual (MEI)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Porte</label>
              <input
                type="text"
                value={form.porte}
                onChange={(e) => setForm({ ...form, porte: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Natureza Jurídica</label>
              <input
                type="text"
                value={form.naturezaJuridica}
                onChange={(e) => setForm({ ...form, naturezaJuridica: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">CNAE Principal</label>
              <input
                type="text"
                value={form.cnaePrincipal}
                onChange={(e) => setForm({ ...form, cnaePrincipal: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Descrição da Atividade Econômica</label>
              <input
                type="text"
                value={form.cnaeDescricao}
                onChange={(e) => setForm({ ...form, cnaeDescricao: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            {/* Endereço */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Logradouro</label>
              <input
                type="text"
                value={form.logradouro}
                onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Número</label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Bairro</label>
              <input
                type="text"
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Município / UF</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Município"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  className="w-3/4 px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
                <input
                  type="text"
                  placeholder="UF"
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                  className="w-1/4 px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono text-center focus:ring-2 focus:ring-[#00A6FF] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">CEP</label>
              <input
                type="text"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground uppercase mb-1">E-mail Cadastral</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Dados Bancários Sicredi */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[#0B3D91]" />
            <span>Conta Bancária Sicredi</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Agência</label>
              <input
                type="text"
                placeholder="Ex: 0101"
                value={form.agenciaSicredi}
                onChange={(e) => setForm({ ...form, agenciaSicredi: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">Conta Corrente</label>
              <input
                type="text"
                placeholder="Ex: 12345-6"
                value={form.contaSicredi}
                onChange={(e) => setForm({ ...form, contaSicredi: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bloco 3: Automação Inteligente com IA & E-mail */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#FF7A00]" />
            <span>Automação com IA (Google Gemini) & Caixa de E-mail Dedicada</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>Chave da API do Google Gemini (GEMINI_API_KEY)</span>
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={form.geminiApiKey}
                onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Utilizada para ler boletos, faturas, XMLs e comprovantes de forma multimodal e lançar no ERP.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">
                E-mail Dedicado Monitorado
              </label>
              <input
                type="email"
                placeholder="financeiro.app@apaatreinamento.net.br"
                value={form.emailFinanceiro}
                onChange={(e) => setForm({ ...form, emailFinanceiro: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground uppercase mb-1">
                Marcador / Pasta do E-mail
              </label>
              <input
                type="text"
                placeholder="INBOX ou Marcador específico"
                value={form.emailFolder}
                onChange={(e) => setForm({ ...form, emailFolder: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#00A6FF] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#082e6e] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando Configurações...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

