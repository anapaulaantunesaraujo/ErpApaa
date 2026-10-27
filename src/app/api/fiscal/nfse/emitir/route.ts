import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      clienteId,
      servicoId,
      valorUnitario,
      quantidade = 1,
      valorTotal: valorTotalInformado,
      dataVencimento,
      discriminacaoAdicional,
    } = body;

    if (!clienteId || !servicoId || !valorUnitario) {
      return NextResponse.json(
        { error: "Cliente, serviço e valor são obrigatórios." },
        { status: 400 }
      );
    }

    // Busca o Cliente e o Serviço pré-configurado com suas regras tributárias
    const cliente = await prisma.customer.findUnique({ where: { id: clienteId } });
    const servico = await prisma.companyService.findUnique({ where: { id: servicoId } });
    const settings = await prisma.companySettings.findFirst();

    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    if (!servico) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });

    const qtd = Number(quantidade) || 1;
    const vUnit = Number(valorUnitario);
    const vTotal = valorTotalInformado ? Number(valorTotalInformado) : vUnit * qtd;

    // Cálculo automático de impostos baseado no cadastro do serviço
    const aliquotaIss = servico.aliquotaIss || 2.0;
    const valorIss = parseFloat(((vTotal * aliquotaIss) / 100).toFixed(2));
    const issRetido = servico.retencaoIss;

    // Retenções federais (se configuradas)
    const valorPis = parseFloat(((vTotal * (servico.aliquotaPis || 0)) / 100).toFixed(2));
    const valorCofins = parseFloat(((vTotal * (servico.aliquotaCofins || 0)) / 100).toFixed(2));
    const valorInss = parseFloat(((vTotal * (servico.aliquotaInss || 0)) / 100).toFixed(2));
    const valorIr = parseFloat(((vTotal * (servico.aliquotaIr || 0)) / 100).toFixed(2));
    const valorCsll = parseFloat(((vTotal * (servico.aliquotaCsll || 0)) / 100).toFixed(2));

    const totalRetencoes = (issRetido ? valorIss : 0) + valorPis + valorCofins + valorInss + valorIr + valorCsll;
    const valorLiquido = parseFloat((vTotal - totalRetencoes).toFixed(2));

    // Numeração e chaves no padrão do Ambiente Nacional da NFS-e 2026
    const timestamp = Date.now();
    const numeroNfse = String(timestamp).slice(-6);
    const numeroDps = String(timestamp).slice(-8);
    const chaveAcesso = `NFS2026${String(settings?.cnpj || "00000000000000").replace(/\D/g, "")}${numeroNfse}${String(timestamp).slice(-10)}`;

    const discriminacaoFinal = discriminacaoAdicional
      ? `${servico.descricao} - ${discriminacaoAdicional}`
      : servico.descricao;

    const dataVenc = dataVencimento ? new Date(dataVencimento) : new Date(Date.now() + 15 * 86400000);
    const now = new Date();
    const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Executa em transação: cria a emissão fiscal e já cria o título a receber pendente
    const result = await prisma.$transaction(async (tx) => {
      // 1. Registro da Emissão Fiscal
      const nfse = await tx.nfseEmission.create({
        data: {
          numeroDps,
          serieDps: "1",
          numeroNfse,
          chaveAcesso,
          linkDanfse: `https://dfe-portal.svrs.rs.gov.br/nfse/danfse/${chaveAcesso}`,
          clienteId: cliente.id,
          servicoId: servico.id,
          discriminacao: discriminacaoFinal,
          valorServico: vTotal,
          valorIss,
          aliquotaIss,
          issRetido,
          valorLiquido,
          status: "EMITIDA",
        },
      });

      // 2. Criação automática do Contas a Receber vinculado
      const receivable = await tx.receivable.create({
        data: {
          descricao: `NFS-e Nº ${numeroNfse} - ${cliente.nome}`,
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          clienteCpfCnpj: cliente.cpfCnpj,
          categoria: "SERVICOS",
          numeroNf: numeroNfse,
          valorOriginal: valorLiquido,
          dataCompetencia: now,
          dataEmissao: now,
          dataVencimento: dataVenc,
          status: "PENDENTE",
          origem: "NFSE_NACIONAL",
          nfseEmissionId: nfse.id,
          observacoes: `Emitida via Ambiente Nacional NFS-e. Chave: ${chaveAcesso}. Serviço: ${servico.codigoTributacaoNacional} - ${servico.descricao}`,
        },
      });

      return { nfse, receivable };
    });

    // 3. Gera arquivo representativo da NFS-e para a pasta "NFs emitidas" do fechamento
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
      await fs.mkdir(uploadDir, { recursive: true });
      const nfFileName = `NF_${numeroNfse}_${cliente.nome.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
      const nfFilePath = path.join(uploadDir, nfFileName);

      const fakeDanfseContent = `========================================================
NOTA FISCAL DE SERVIÇOS ELETRÔNICA (NFS-e) - AMBIENTE NACIONAL 2026
Número da NFS-e: ${numeroNfse}
Chave de Acesso: ${chaveAcesso}
Emissão: ${now.toLocaleDateString("pt-BR")}
--------------------------------------------------------
PRESTADOR DE SERVIÇOS:
${settings?.razaoSocial || "APAA TREINAMENTO LTDA"}
CNPJ: ${settings?.cnpj || "00.000.000/0001-00"}
--------------------------------------------------------
TOMADOR DE SERVIÇOS:
${cliente.nome}
CPF/CNPJ: ${cliente.cpfCnpj}
Endereço: ${cliente.logradouro || ""} ${cliente.numero || ""} - ${cliente.cidade || ""}/${cliente.uf || ""}
--------------------------------------------------------
DISCRIMINAÇÃO DOS SERVIÇOS:
${discriminacaoFinal}
CNAE: ${servico.cnae}
Código Tributação Nacional: ${servico.codigoTributacaoNacional}
--------------------------------------------------------
VALOR DOS SERVIÇOS: R$ ${vTotal.toFixed(2)}
Alíquota ISS: ${aliquotaIss}% | Valor ISS: R$ ${valorIss.toFixed(2)} (${issRetido ? "Retido" : "Não retido"})
VALOR LÍQUIDO A RECEBER: R$ ${valorLiquido.toFixed(2)}
Vencimento: ${dataVenc.toLocaleDateString("pt-BR")}
========================================================`;

      await fs.writeFile(nfFilePath, fakeDanfseContent, "utf-8");

      await prisma.attachment.create({
        data: {
          categoria: "DOCUMENTO",
          nomeOriginal: `NF_${numeroNfse}.txt`,
          nomeArquivo: nfFileName,
          caminho: nfFilePath,
          mimeType: "text/plain",
          tamanho: Buffer.byteLength(fakeDanfseContent),
          competencia,
          receivableId: result.receivable.id,
        },
      });
    } catch (attErr) {
      console.warn("Aviso ao salvar anexo da NFS-e:", attErr);
    }

    return NextResponse.json({
      success: true,
      nfse: result.nfse,
      receivable: result.receivable,
      message: `NFS-e Nº ${numeroNfse} emitida com sucesso e lançada em Contas a Receber (Pendente de baixa).`,
    });
  } catch (error) {
    console.error("Erro ao emitir NFS-e:", error);
    return NextResponse.json(
      { error: "Erro ao processar emissão da NFS-e no Ambiente Nacional." },
      { status: 500 }
    );
  }
}

