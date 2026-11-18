import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { analyzeFinancialDocumentWithAI } from "./ai-document-analyzer";
import path from "path";
import fs from "fs/promises";

export interface EmailSyncResult {
  totalEmailsProcessados: number;
  totalAnexosProcessados: number;
  contasPagarCriadas: number;
  contasReceberCriadas: number;
  baixasEfetuadas: number;
  extratosImportados: number;
  erros: string[];
}

export async function sincronizarEmailsMarcadorGmail(): Promise<EmailSyncResult> {
  const settings = await prisma.companySettings.findFirst();

  const user = process.env.GMAIL_USER || settings?.emailUser || "apaaerp@gmail.com";
  const pass = process.env.GMAIL_APP_PASS || settings?.emailPass || "fgut uliz evis bqdm";
  const host = process.env.IMAP_HOST || settings?.emailHost || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || settings?.emailPort || 993);
  const configuredFolder = settings?.emailFolder || process.env.GMAIL_FOLDER || "Financeiro";
  const companyCnpjClean = settings?.cnpj ? settings.cnpj.replace(/\D/g, "") : "50756275000128";

  const result: EmailSyncResult = {
    totalEmailsProcessados: 0,
    totalAnexosProcessados: 0,
    contasPagarCriadas: 0,
    contasReceberCriadas: 0,
    baixasEfetuadas: 0,
    extratosImportados: 0,
    erros: [],
  };

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: {
      user,
      pass: pass.replace(/\s+/g, ""), // Remove espaços da senha de app se houver
    },
    logger: false,
  });

  try {
    await client.connect();

    // 1. Lista as caixas/marcadores existentes para encontrar o nome exato (ex: "Financeiro" ou "APAA_FINANCEIRO")
    const mailboxes = await client.list();
    let targetFolder = "";

    const candidateNames = [
      configuredFolder.toLowerCase(),
      "financeiro",
      "apaa_financeiro",
      "apaa financeiro",
    ];

    for (const mb of mailboxes) {
      const mbNameLower = mb.name.toLowerCase();
      const mbPathLower = mb.path.toLowerCase();
      if (candidateNames.some((c) => mbNameLower === c || mbPathLower === c || mbPathLower.endsWith(`/${c}`))) {
        targetFolder = mb.path;
        break;
      }
    }

    if (!targetFolder) {
      targetFolder = configuredFolder;
    }

    let lock;
    try {
      lock = await client.getMailboxLock(targetFolder);
    } catch {
      try {
        lock = await client.getMailboxLock("Financeiro");
      } catch {
        lock = await client.getMailboxLock("INBOX");
      }
    }

    try {
      // 2. Busca e-mails na pasta (todos ou os 20 mais recentes)
      const messages = client.fetch("1:*", { source: true, uid: true, envelope: true });

      const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
      await fs.mkdir(uploadDir, { recursive: true });

      const now = new Date();
      const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      for await (const message of messages) {
        if (!message.source) continue;
        result.totalEmailsProcessados++;
        const parsed: any = await simpleParser(message.source);
        const messageId: string = parsed.messageId || `msg_${message.uid}_${Date.now()}`;

        // Verifica se já processou esse messageId para evitar duplicidade
        const existingLog = await prisma.emailSyncLog.findFirst({
          where: { messageId },
        });
        if (existingLog) continue;

        let totalAnexosMsg = 0;
        const detalhesItens: string[] = [];

        for (const attachment of parsed.attachments) {
          result.totalAnexosProcessados++;
          totalAnexosMsg++;

          const buffer = attachment.content;
          const fileName = attachment.filename || `anexo_${Date.now()}.bin`;
          const mimeType = attachment.contentType || "application/octet-stream";

          // Salva anexo em disco
          const safeOriginalName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const uniqueFileName = `${Date.now()}_${safeOriginalName}`;
          const filePath = path.join(uploadDir, uniqueFileName);
          await fs.writeFile(filePath, buffer);

          // Análise Inteligente com IA Multimodal
          try {
            const analysis = await analyzeFinancialDocumentWithAI(
              buffer,
              mimeType,
              fileName,
              settings?.geminiApiKey || undefined
            );

            const cleanPagador = String(analysis.cnpjPagador || "").replace(/\D/g, "");
            const cleanRecebedor = String(analysis.cnpjRecebedor || "").replace(/\D/g, "");

            // COMPROVANTE DE PAGAMENTO -> Baixa Automática
            if (analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO") {
              const payableMatch = await prisma.payable.findFirst({
                where: {
                  valorOriginal: { gte: analysis.valor - 0.2, lte: analysis.valor + 0.2 },
                  status: { in: ["PENDENTE", "PARCIAL"] },
                },
                orderBy: { dataVencimento: "desc" },
              });

              const att = await prisma.attachment.create({
                data: {
                  categoria: "COMPROVANTE",
                  nomeOriginal: fileName,
                  nomeArquivo: uniqueFileName,
                  caminho: filePath,
                  mimeType,
                  tamanho: buffer.length,
                  competencia,
                  payableId: payableMatch?.id || null,
                },
              });

              if (payableMatch) {
                const dataPag = analysis.dataPagamento ? new Date(analysis.dataPagamento) : now;
                await prisma.paymentRecord.create({
                  data: {
                    tipo: "PAGAMENTO",
                    payableId: payableMatch.id,
                    data: dataPag,
                    valor: analysis.valor,
                    formaPagamento: "PIX",
                    comprovanteAnexoId: att.id,
                    observacoes: `Baixa automática via e-mail ${user} (${fileName})`,
                  },
                });

                await prisma.payable.update({
                  where: { id: payableMatch.id },
                  data: {
                    valorPago: payableMatch.valorOriginal,
                    status: "PAGO",
                    dataPagamento: dataPag,
                  },
                });

                result.baixasEfetuadas++;
                detalhesItens.push(`Baixa efetuada no título ${payableMatch.descricao} (R$ ${analysis.valor.toFixed(2)})`);
              }
            }
            // APAA É A RECEBEDORA / EMISSORA -> Contas a Receber
            else if (cleanRecebedor === companyCnpjClean) {
              const dataVenc = analysis.dataVencimento
                ? new Date(analysis.dataVencimento)
                : new Date(Date.now() + 10 * 86400000);

              const rec = await prisma.receivable.create({
                data: {
                  descricao: analysis.descricao || `Recebimento de ${analysis.nomePagador || "Cliente"}`,
                  clienteNome: analysis.nomePagador || "Cliente Identificado via E-mail",
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
                  nomeOriginal: fileName,
                  nomeArquivo: uniqueFileName,
                  caminho: filePath,
                  mimeType,
                  tamanho: buffer.length,
                  competencia,
                  receivableId: rec.id,
                },
              });

              result.contasReceberCriadas++;
              detalhesItens.push(`Conta a Receber criada: ${rec.descricao} (R$ ${rec.valorOriginal.toFixed(2)})`);
            }
            // APAA É A PAGADORA OU FORNECEDOR EXTERNO -> Contas a Pagar
            else {
              const dataVenc = analysis.dataVencimento
                ? new Date(analysis.dataVencimento)
                : new Date(Date.now() + 5 * 86400000);

              const pay = await prisma.payable.create({
                data: {
                  descricao: analysis.descricao || `Conta de ${analysis.nomeRecebedor || "Fornecedor"}`,
                  fornecedorNome: analysis.nomeRecebedor || "Fornecedor Identificado via E-mail",
                  fornecedorCpfCnpj: analysis.cnpjRecebedor || null,
                  categoria: analysis.categoriaAnexo === "BOLETO" ? "BOLETO" : "FORNECEDORES",
                  numeroDocumento: analysis.numeroDocumento || null,
                  linhaDigitavel: analysis.linhaDigitavel || null,
                  chavePix: analysis.chavePix || null,
                  valorOriginal: analysis.valor,
                  dataCompetencia: now,
                  dataVencimento: dataVenc,
                  status: "PENDENTE",
                  origem: "EMAIL_IA",
                },
              });

              await prisma.attachment.create({
                data: {
                  categoria: analysis.categoriaAnexo,
                  nomeOriginal: fileName,
                  nomeArquivo: uniqueFileName,
                  caminho: filePath,
                  mimeType,
                  tamanho: buffer.length,
                  competencia,
                  payableId: pay.id,
                },
              });

              result.contasPagarCriadas++;
              detalhesItens.push(`Conta a Pagar criada: ${pay.descricao} (R$ ${pay.valorOriginal.toFixed(2)})`);
            }
          } catch (anexoErr: any) {
            result.erros.push(`Erro ao processar anexo ${fileName}: ${anexoErr.message}`);
          }
        }

        // Marca mensagem como lida no Gmail
        await client.messageFlagsAdd({ uid: message.uid }, ["\\Seen"]);

        // Registra histórico de sincronização
        await prisma.emailSyncLog.create({
          data: {
            messageId,
            from: parsed.from?.text || "Desconhecido",
            subject: parsed.subject || "Sem assunto",
            data: parsed.date || now,
            totalAnexos: totalAnexosMsg,
            status: result.erros.length === 0 ? "SUCESSO" : "PARCIAL",
            resultadoIa: "Processado com IA Multimodal",
            itensCriados: detalhesItens.join("; "),
          },
        });
      }
    } finally {
      lock.release();
    }
  } catch (error: any) {
    result.erros.push(`Falha na conexão IMAP com o Gmail: ${error.message}`);
  } finally {
    try {
      await client.logout();
    } catch {}
  }

  return result;
}
