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
  pastasVerificadas?: string[];
  erros: string[];
}

export async function sincronizarEmailsMarcadorGmail(): Promise<EmailSyncResult> {
  const startTime = Date.now();
  // Limite estrito de 35 segundos para responder bem antes do timeout do Cloud Run (60s/300s)
  const MAX_EXECUTION_TIME_MS = 35_000;

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
    pastasVerificadas: [],
    erros: [],
  };

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: {
      user,
      pass: pass.replace(/\s+/g, ""), // Remove espaços da senha de aplicativo
    },
    logger: false,
  });

  const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
  await fs.mkdir(uploadDir, { recursive: true });

  const now = new Date();
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const processedMessageIdsInRun = new Set<string>();

  // Função recursiva para desempacotar e-mails anexados (.eml / message/rfc822)
  async function extrairTodosOsAnexos(
    parsedMail: any,
    depth = 0
  ): Promise<Array<{ buffer: Buffer; fileName: string; mimeType: string; contextSubject?: string }>> {
    const lista: Array<{ buffer: Buffer; fileName: string; mimeType: string; contextSubject?: string }> = [];
    if (depth > 5) return lista;

    for (const att of parsedMail.attachments || []) {
      const fn = att.filename || `anexo_${Date.now()}.bin`;
      const ct = (att.contentType || "").toLowerCase();

      // Se o anexo for um e-mail encaminhado (.eml ou message/rfc822)
      const isEml =
        ct.includes("message/rfc822") ||
        ct.includes("message/rfc2822") ||
        fn.toLowerCase().endsWith(".eml") ||
        fn.toLowerCase().endsWith(".msg");

      if (isEml && att.content) {
        try {
          const subMail: any = await simpleParser(att.content);
          const subSubject = subMail.subject || fn.replace(/\.eml$/i, "");
          const subAnexos = await extrairTodosOsAnexos(subMail, depth + 1);

          if (subAnexos.length > 0) {
            for (const sa of subAnexos) {
              lista.push({
                ...sa,
                contextSubject: sa.contextSubject || subSubject,
              });
            }
          } else {
            // Se o e-mail anexado não tiver arquivo, mas tiver texto explicativo/comprovante
            const textContent = subMail.text || (subMail.html ? subMail.html.replace(/<[^>]+>/g, " ") : "");
            if (textContent && textContent.trim().length > 20) {
              lista.push({
                buffer: Buffer.from(textContent, "utf-8"),
                fileName: `${subSubject.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`,
                mimeType: "text/plain",
                contextSubject: subSubject,
              });
            }
          }
        } catch (emlErr) {
          console.warn(`Erro ao desempacotar e-mail anexado ${fn}:`, emlErr);
          lista.push({
            buffer: att.content,
            fileName: fn,
            mimeType: att.contentType || "application/octet-stream",
            contextSubject: parsedMail.subject,
          });
        }
      } else if (att.content) {
        lista.push({
          buffer: att.content,
          fileName: fn,
          mimeType: att.contentType || "application/octet-stream",
          contextSubject: parsedMail.subject,
        });
      }
    }

    // Se o e-mail não tem anexos em arquivo, mas tem comprovante no próprio corpo
    if (lista.length === 0 && depth === 0) {
      const textContent = parsedMail.text || (parsedMail.html ? parsedMail.html.replace(/<[^>]+>/g, " ") : "");
      const lower = textContent.toLowerCase();
      if (
        lower.includes("comprovante") ||
        lower.includes("boleto") ||
        lower.includes("pagamento") ||
        lower.includes("transferência") ||
        lower.includes("pix")
      ) {
        lista.push({
          buffer: Buffer.from(textContent, "utf-8"),
          fileName: `${(parsedMail.subject || "email").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`,
          mimeType: "text/plain",
          contextSubject: parsedMail.subject,
        });
      }
    }

    return lista;
  }

  try {
    await client.connect();

    // 1. Identifica todas as pastas de interesse no Gmail (Financeiro, Salvos, Comprovantes e INBOX)
    const mailboxes = await client.list();
    const candidateFolders: string[] = [];

    // Prioridade 1: Pastas com "financeiro" ou nome configurado
    for (const mb of mailboxes) {
      const p = mb.path.toLowerCase();
      const n = mb.name.toLowerCase();
      if (
        n === "financeiro" ||
        p === "financeiro" ||
        p.endsWith("/financeiro") ||
        (configuredFolder && (n === configuredFolder.toLowerCase() || p === configuredFolder.toLowerCase()))
      ) {
        if (!candidateFolders.includes(mb.path)) candidateFolders.push(mb.path);
      }
    }

    // Prioridade 2: Pastas contendo "salvos" ou "comprovantes"
    for (const mb of mailboxes) {
      const p = mb.path.toLowerCase();
      if (p.includes("salvos") || p.includes("comprovantes")) {
        if (!candidateFolders.includes(mb.path)) candidateFolders.push(mb.path);
      }
    }

    // Prioridade 3: INBOX (onde chegam e-mails encaminhados diretamente)
    const inboxMb = mailboxes.find(
      (mb) => mb.path.toUpperCase() === "INBOX" || mb.name.toUpperCase() === "INBOX"
    );
    if (inboxMb && !candidateFolders.includes(inboxMb.path)) {
      candidateFolders.push(inboxMb.path);
    }

    if (candidateFolders.length === 0) {
      candidateFolders.push("INBOX");
    }

    result.pastasVerificadas = candidateFolders;

    // 2. Itera sobre cada pasta com orçamento de tempo estrito
    for (const folderPath of candidateFolders) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log("Tempo limite atingido para evitar timeout no Cloud Run. Finalizando lote.");
        break;
      }

      let lock;
      try {
        lock = await client.getMailboxLock(folderPath);
      } catch (lockErr: any) {
        console.warn(`Não foi possível abrir pasta ${folderPath}:`, lockErr.message);
        continue;
      }

      try {
        const totalMsgs = client.mailbox ? client.mailbox.exists : 0;
        if (totalMsgs === 0) continue;

        // Busca apenas as mensagens mais recentes (últimas 20 mensagens por pasta)
        const startSeq = Math.max(1, totalMsgs - 19);
        const seqRange = `${startSeq}:*`;

        // Busca metadados RÁPIDA (apenas UID e Envelope, sem baixar conteúdo pesado)
        const messagesCursor = client.fetch(seqRange, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
        });

        const messagesToProcess: Array<{ uid: number; messageId: string }> = [];

        for await (const msg of messagesCursor) {
          const internalTime = msg.internalDate ? new Date(msg.internalDate).getTime() : 0;
          const msgId =
            msg.envelope?.messageId || `msg_${folderPath}_${msg.uid}_${internalTime}`;

          if (processedMessageIdsInRun.has(msgId)) continue;

          // Verifica se já processou no banco de dados
          const existingLog = await prisma.emailSyncLog.findFirst({
            where: { messageId: msgId },
          });

          if (!existingLog) {
            messagesToProcess.push({ uid: msg.uid, messageId: msgId });
          }
        }

        // Processa cada e-mail novo individualmente
        for (const item of messagesToProcess) {
          if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
            break;
          }

          processedMessageIdsInRun.add(item.messageId);

          // Baixa o conteúdo completo (source) APENAS do e-mail que realmente será processado
          const fullMsg = await client.fetchOne(item.uid, { source: true }, { uid: true });
          if (!fullMsg || !fullMsg.source) continue;

          result.totalEmailsProcessados++;
          const parsed: any = await simpleParser(fullMsg.source);
          const emailSubject = parsed.subject || "Sem assunto";
          let totalAnexosMsg = 0;
          const detalhesItens: string[] = [];

          // Extrai todos os anexos (incluindo desempacotamento de .eml)
          const todosOsAnexos = await extrairTodosOsAnexos(parsed);

          for (const anexoItem of todosOsAnexos) {
            result.totalAnexosProcessados++;
            totalAnexosMsg++;

            const buffer = anexoItem.buffer;
            const fileName = anexoItem.fileName;
            const mimeType = anexoItem.mimeType;
            const contextSubject = anexoItem.contextSubject || emailSubject;

            // Salva anexo em disco
            const safeOriginalName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
            const uniqueFileName = `${Date.now()}_${safeOriginalName}`;
            const filePath = path.join(uploadDir, uniqueFileName);
            await fs.writeFile(filePath, buffer);

            // Análise com IA Multimodal / Heurística
            try {
              const analysis = await analyzeFinancialDocumentWithAI(
                buffer,
                mimeType,
                fileName,
                settings?.geminiApiKey || undefined,
                contextSubject
              );

              const cleanPagador = String(analysis.cnpjPagador || "").replace(/\D/g, "");
              const cleanRecebedor = String(analysis.cnpjRecebedor || "").replace(/\D/g, "");

              // COMPROVANTE DE PAGAMENTO
              if (analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO") {
                // Tenta localizar um título a pagar pendente com valor aproximado
                const payableMatch = analysis.valor > 0 ? await prisma.payable.findFirst({
                  where: {
                    valorOriginal: { gte: analysis.valor - 0.5, lte: analysis.valor + 0.5 },
                    status: { in: ["PENDENTE", "PARCIAL"] },
                  },
                  orderBy: { dataVencimento: "desc" },
                }) : null;

                const dataPag = analysis.dataPagamento ? new Date(analysis.dataPagamento) : now;

                if (payableMatch) {
                  // Baixa no título existente
                  const att = await prisma.attachment.create({
                    data: {
                      categoria: "COMPROVANTE",
                      nomeOriginal: fileName,
                      nomeArquivo: uniqueFileName,
                      caminho: filePath,
                      mimeType,
                      tamanho: buffer.length,
                      competencia,
                      payableId: payableMatch.id,
                    },
                  });

                  await prisma.paymentRecord.create({
                    data: {
                      tipo: "PAGAMENTO",
                      payableId: payableMatch.id,
                      data: dataPag,
                      valor: analysis.valor,
                      formaPagamento: "PIX",
                      comprovanteAnexoId: att.id,
                      observacoes: `Baixa automática via e-mail (${contextSubject})`,
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
                  detalhesItens.push(
                    `Baixa efetuada no título ${payableMatch.descricao} (R$ ${analysis.valor.toFixed(2)})`
                  );
                } else {
                  // CRÍTICO: Se o título ainda não existia, cria diretamente como PAGO!
                  const pay = await prisma.payable.create({
                    data: {
                      descricao: analysis.descricao || `Pagamento: ${contextSubject}`,
                      fornecedorNome: analysis.nomeRecebedor || "Fornecedor / Beneficiário Identificado no Comprovante",
                      fornecedorCpfCnpj: analysis.cnpjRecebedor || null,
                      categoria: "OUTROS",
                      numeroDocumento: analysis.numeroDocumento || null,
                      linhaDigitavel: analysis.linhaDigitavel || null,
                      chavePix: analysis.chavePix || null,
                      valorOriginal: analysis.valor,
                      valorPago: analysis.valor,
                      dataCompetencia: now,
                      dataVencimento: dataPag,
                      dataPagamento: dataPag,
                      status: "PAGO",
                      origem: "EMAIL_IA",
                    },
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
                      payableId: pay.id,
                    },
                  });

                  await prisma.paymentRecord.create({
                    data: {
                      tipo: "PAGAMENTO",
                      payableId: pay.id,
                      data: dataPag,
                      valor: analysis.valor,
                      formaPagamento: "PIX",
                      comprovanteAnexoId: att.id,
                      observacoes: `Comprovante importado do e-mail (${contextSubject})`,
                    },
                  });

                  result.contasPagarCriadas++;
                  result.baixasEfetuadas++;
                  detalhesItens.push(
                    `Conta paga lançada: ${pay.descricao} (R$ ${pay.valorOriginal.toFixed(2)})`
                  );
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
              // APAA É A PAGADORA OU FORNECEDOR EXTERNO -> Contas a Pagar Pendente
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

          // Marca mensagem como lida
          try {
            await client.messageFlagsAdd({ uid: item.uid }, ["\\Seen"]);
          } catch {}

          // Registra no banco para não processar novamente
          await prisma.emailSyncLog.create({
            data: {
              messageId: item.messageId,
              from: parsed.from?.text || "Desconhecido",
              subject: emailSubject,
              data: parsed.date || now,
              totalAnexos: totalAnexosMsg,
              status: result.erros.length === 0 ? "SUCESSO" : "PARCIAL",
              resultadoIa: "Processado com IA Multimodal",
              itensCriados: detalhesItens.join("; ") || "Nenhum documento financeiro extraído",
            },
          });
        }
      } finally {
        lock.release();
      }
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
