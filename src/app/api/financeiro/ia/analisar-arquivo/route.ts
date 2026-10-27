import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { analyzeFinancialDocumentWithAI } from "@/lib/services/ai-document-analyzer";
import path from "path";
import fs from "fs/promises";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado para análise." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Busca configurações da empresa para ler CNPJ e chave da IA
    const settings = await prisma.companySettings.findFirst();
    const companyCnpjClean = String(settings?.cnpj || "").replace(/\D/g, "");

    // Executa a análise inteligente via IA
    const analysis = await analyzeFinancialDocumentWithAI(
      buffer,
      file.type || "application/pdf",
      file.name,
      settings?.geminiApiKey || undefined
    );

    const now = new Date();
    const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Salva o arquivo no disco
    const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
    await fs.mkdir(uploadDir, { recursive: true });
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}_${analysis.categoriaAnexo}_${safeOriginalName}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    await fs.writeFile(filePath, buffer);

    const cleanPagador = String(analysis.cnpjPagador || "").replace(/\D/g, "");
    const cleanRecebedor = String(analysis.cnpjRecebedor || "").replace(/\D/g, "");

    let createdType = "";
    let createdItem: any = null;

    // REGRA 1: É Comprovante de Pagamento
    if (analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO") {
      // Localiza o título a pagar pelo valor aproximado
      const payableMatch = await prisma.payable.findFirst({
        where: {
          valorOriginal: { gte: analysis.valor - 0.1, lte: analysis.valor + 0.1 },
          status: { in: ["PENDENTE", "PARCIAL"] },
        },
        orderBy: { dataVencimento: "desc" },
      });

      const payableId = payableMatch?.id || null;

      // Cria o registro do anexo categorizado como COMPROVANTE
      const attachment = await prisma.attachment.create({
        data: {
          categoria: "COMPROVANTE",
          nomeOriginal: file.name,
          nomeArquivo: uniqueFileName,
          caminho: filePath,
          mimeType: file.type || "application/pdf",
          tamanho: file.size,
          competencia,
          payableId,
        },
      });

      if (payableMatch) {
        // Realiza a baixa automática do título
        const dataPagamento = analysis.dataPagamento ? new Date(analysis.dataPagamento) : now;
        await prisma.paymentRecord.create({
          data: {
            tipo: "PAGAMENTO",
            payableId: payableMatch.id,
            data: dataPagamento,
            valor: analysis.valor,
            formaPagamento: "PIX",
            comprovanteAnexoId: attachment.id,
            observacoes: `Baixa automática via IA a partir do comprovante ${file.name}`,
          },
        });

        createdItem = await prisma.payable.update({
          where: { id: payableMatch.id },
          data: {
            valorPago: payableMatch.valorOriginal,
            status: "PAGO",
            dataPagamento,
          },
        });
        createdType = "BAIXA_CONTAS_PAGAR";
      } else {
        createdType = "COMPROVANTE_AVULSO";
      }
    }
    // REGRA 2: APAA é a Recebedora ou Emissora do documento -> Contas a Receber
    else if (companyCnpjClean && cleanRecebedor === companyCnpjClean) {
      const dataVenc = analysis.dataVencimento ? new Date(analysis.dataVencimento) : new Date(Date.now() + 10 * 86400000);

      const receivable = await prisma.receivable.create({
        data: {
          descricao: analysis.descricao || `Recebimento de ${analysis.nomePagador || "Cliente"}`,
          clienteNome: analysis.nomePagador || "Cliente Identificado pela IA",
          clienteCpfCnpj: analysis.cnpjPagador || null,
          categoria: "SERVICOS",
          numeroNf: analysis.numeroDocumento || null,
          valorOriginal: analysis.valor,
          dataCompetencia: now,
          dataVencimento: dataVenc,
          status: "PENDENTE",
          origem: "EMAIL_IA",
        },
      });

      await prisma.attachment.create({
        data: {
          categoria: "DOCUMENTO",
          nomeOriginal: file.name,
          nomeArquivo: uniqueFileName,
          caminho: filePath,
          mimeType: file.type || "application/pdf",
          tamanho: file.size,
          competencia,
          receivableId: receivable.id,
        },
      });

      createdType = "CONTAS_RECEBER";
      createdItem = receivable;
    }
    // REGRA 3: APAA é a Pagadora (ou padrão se não for identificada como emissora) -> Contas a Pagar
    else {
      const dataVenc = analysis.dataVencimento ? new Date(analysis.dataVencimento) : new Date(Date.now() + 5 * 86400000);

      const payable = await prisma.payable.create({
        data: {
          descricao: analysis.descricao || `Despesa com ${analysis.nomeRecebedor || "Fornecedor"}`,
          fornecedorNome: analysis.nomeRecebedor || "Fornecedor Identificado pela IA",
          fornecedorCpfCnpj: analysis.cnpjRecebedor || null,
          categoria: "GERAL",
          numeroDocumento: analysis.numeroDocumento || null,
          valorOriginal: analysis.valor,
          dataCompetencia: now,
          dataVencimento: dataVenc,
          linhaDigitavel: analysis.linhaDigitavel || null,
          chavePix: analysis.chavePix || null,
          status: "PENDENTE",
          origem: "EMAIL_IA",
        },
      });

      await prisma.attachment.create({
        data: {
          categoria: analysis.categoriaAnexo,
          nomeOriginal: file.name,
          nomeArquivo: uniqueFileName,
          caminho: filePath,
          mimeType: file.type || "application/pdf",
          tamanho: file.size,
          competencia,
          payableId: payable.id,
        },
      });

      createdType = "CONTAS_PAGAR";
      createdItem = payable;
    }

    return NextResponse.json({
      success: true,
      analysis,
      createdType,
      createdItem,
    });
  } catch (error) {
    console.error("Erro na análise inteligente com IA:", error);
    return NextResponse.json(
      { error: "Erro ao processar análise inteligente do documento." },
      { status: 500 }
    );
  }
}

