import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import {
  analyzeFinancialDocumentWithAI,
  advancedHeuristicDocumentParser,
} from "./ai-document-analyzer";
import { addAuditLog } from "./audit-logger";
import path from "path";
import fs from "fs/promises";

export interface EmailSyncResult {
  totalEmailsProcessados: number;
  totalAnexosProcessados: number;
  contasPagarCriadas: number;
  contasReceberCriadas: number;
  baixasEfetuadas: number;
  extratosImportados: number;
  itensAtualizados?: number;
  duplicadosRemovidos?: number;
  pastasVerificadas?: string[];
  erros: string[];
}

// Função recursiva para desempacotar e-mails anexados (.eml / message/rfc822)
export async function extrairTodosOsAnexos(
  parsedMail: any,
  depth = 0
): Promise<Array<{ buffer: Buffer; fileName: string; mimeType: string; contextSubject?: string }>> {
  const lista: Array<{ buffer: Buffer; fileName: string; mimeType: string; contextSubject?: string }> = [];
  if (depth > 5) return lista;

  for (const att of parsedMail.attachments || []) {
    const fn = att.filename || `anexo_${Date.now()}.bin`;
    const ct = (att.contentType || "").toLowerCase();

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
      } catch (emlErr: any) {
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

export async function sincronizarEmailsMarcadorGmail(): Promise<EmailSyncResult> {
  const startTime = Date.now();
  // Limite estrito de 25 segundos para SEMPRE responder antes do timeout do Cloud Run
  const MAX_EXECUTION_TIME_MS = 25_000;

  // Garante a coluna conteudoBase64 na tabela de anexos para persistência durável no PostgreSQL
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "conteudoBase64" TEXT;`);
  } catch {}

  const settings = await prisma.companySettings.findFirst();

  const user = process.env.GMAIL_USER || settings?.emailUser || "apaaerp@gmail.com";
  const pass = process.env.GMAIL_APP_PASS || settings?.emailPass || "fgut uliz evis bqdm";
  const host = process.env.IMAP_HOST || settings?.emailHost || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || settings?.emailPort || 993);
  const configuredFolder = settings?.emailFolder || process.env.GMAIL_FOLDER || "Financeiro";
  const companyCnpjClean = settings?.cnpj ? settings.cnpj.replace(/\D/g, "") : "50756275000128";

  await addAuditLog(
    "GMAIL_SYNC",
    "INFO",
    "Iniciando Sincronização do Gmail",
    `Tentando conectar como ${user} no servidor ${host}:${port}`,
    { host, port, user, folderConfigurada: configuredFolder }
  );

  const result: EmailSyncResult = {
    totalEmailsProcessados: 0,
    totalAnexosProcessados: 0,
    contasPagarCriadas: 0,
    contasReceberCriadas: 0,
    baixasEfetuadas: 0,
    extratosImportados: 0,
    itensAtualizados: 0,
    duplicadosRemovidos: 0,
    pastasVerificadas: [],
    erros: [],
  };

  const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch {}

  const now = new Date();
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: {
      user,
      pass: pass.replace(/\s+/g, ""),
    },
    logger: false,
  });

  const processedMessageIdsInRun = new Set<string>();

  try {
    await client.connect();
    await addAuditLog("GMAIL_SYNC", "SUCCESS", "Conexão IMAP Estabelecida", `Conectado com sucesso à conta ${user}`);

    const mailboxes = await client.list();
    const candidateFolders: string[] = [];

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

    for (const mb of mailboxes) {
      const p = mb.path.toLowerCase();
      if (p.includes("salvos") || p.includes("comprovantes")) {
        if (!candidateFolders.includes(mb.path)) candidateFolders.push(mb.path);
      }
    }

    const inboxMb = mailboxes.find(
      (mb) => mb.path.toUpperCase() === "INBOX" || mb.name.toUpperCase() === "INBOX"
    );
    if (inboxMb && !candidateFolders.includes(inboxMb.path)) {
      candidateFolders.push(inboxMb.path);
    }

    if (candidateFolders.length === 0) candidateFolders.push("INBOX");
    result.pastasVerificadas = candidateFolders;

    await addAuditLog(
      "GMAIL_SYNC",
      "INFO",
      "Pastas Identificadas para Varredura",
      `Total de ${candidateFolders.length} pastas selecionadas.`,
      { pastas: candidateFolders }
    );

    for (const folderPath of candidateFolders) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        await addAuditLog(
          "GMAIL_SYNC",
          "WARN",
          "Teto de Tempo Atingido",
          "Interrompendo novas pastas para evitar timeout do Cloud Run. O que foi lido foi salvo com sucesso."
        );
        break;
      }

      let lock;
      try {
        lock = await client.getMailboxLock(folderPath);
      } catch (lockErr: any) {
        await addAuditLog(
          "GMAIL_SYNC",
          "WARN",
          `Falha ao obter trava na pasta ${folderPath}`,
          lockErr.message
        );
        continue;
      }

      try {
        const totalMsgs = client.mailbox ? client.mailbox.exists : 0;
        await addAuditLog(
          "GMAIL_SYNC",
          "INFO",
          `Acessando Pasta: ${folderPath}`,
          `Total de mensagens existentes na pasta: ${totalMsgs}`
        );

        if (totalMsgs === 0) continue;

        // Limita a busca às últimas 12 mensagens para garantir resposta rápida
        const startSeq = Math.max(1, totalMsgs - 11);
        const seqRange = `${startSeq}:*`;

        const messagesCursor = client.fetch(seqRange, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
        });

        const messagesToProcess: Array<{ uid: number; messageId: string }> = [];

        for await (const msg of messagesCursor) {
          const internalTime = msg.internalDate ? new Date(msg.internalDate).getTime() : 0;
          const msgId = msg.envelope?.messageId || `msg_${folderPath}_${msg.uid}_${internalTime}`;

          if (!processedMessageIdsInRun.has(msgId)) {
            messagesToProcess.push({ uid: msg.uid, messageId: msgId });
          }
        }

        await addAuditLog(
          "GMAIL_SYNC",
          "INFO",
          `Mensagens na Fila para Processamento (${folderPath})`,
          `Total selecionado: ${messagesToProcess.length} mensagens.`
        );

        for (const item of messagesToProcess) {
          if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
            await addAuditLog(
              "GMAIL_SYNC",
              "WARN",
              "Tempo Limite Preventivo Atingido",
              "Finalizando lote com segurança para responder antes do timeout."
            );
            break;
          }

          processedMessageIdsInRun.add(item.messageId);

          const fullMsg = await client.fetchOne(item.uid, { source: true }, { uid: true });
          if (!fullMsg || !fullMsg.source) continue;

          result.totalEmailsProcessados++;
          const parsed: any = await simpleParser(fullMsg.source);
          const emailSubject = parsed.subject || "Sem assunto";
          const emailFrom = parsed.from?.text || "Desconhecido";
          let totalAnexosMsg = 0;
          const detalhesItens: string[] = [];

          const todosOsAnexos = await extrairTodosOsAnexos(parsed);

          await addAuditLog(
            "GMAIL_SYNC",
            "INFO",
            `E-mail Lido: "${emailSubject}"`,
            `Remetente: ${emailFrom} | Anexos desempacotados: ${todosOsAnexos.length}`,
            {
              assunto: emailSubject,
              de: emailFrom,
              anexos: todosOsAnexos.map((a) => ({ nome: a.fileName, mime: a.mimeType, bytes: a.buffer.length })),
            }
          );

          for (const anexoItem of todosOsAnexos) {
            result.totalAnexosProcessados++;
            totalAnexosMsg++;

            const buffer = anexoItem.buffer;
            const fileName = anexoItem.fileName;
            const mimeType = anexoItem.mimeType;
            const contextSubject = anexoItem.contextSubject || emailSubject;
            const base64Content = buffer.toString("base64");

            // Salva no disco temporário
            const safeOriginalName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
            const uniqueFileName = `${Date.now()}_${safeOriginalName}`;
            const filePath = path.join(uploadDir, uniqueFileName);
            try {
              await fs.writeFile(filePath, buffer);
            } catch {}

            try {
              // Extração de dados com IA Multimodal ou Extrator Nativo com zlib
              const analysis = await analyzeFinancialDocumentWithAI(
                buffer,
                mimeType,
                fileName,
                settings?.geminiApiKey || undefined,
                contextSubject
              );

              await addAuditLog(
                "IA_EXTRACAO",
                analysis.valor > 0 ? "SUCCESS" : "WARN",
                `Análise de Documento: ${fileName}`,
                `Tipo: ${analysis.tipoDocumento} | Valor: R$ ${analysis.valor.toFixed(2)} | Descrição: ${analysis.descricao}`,
                {
                  arquivo: fileName,
                  analise: analysis,
                }
              );

              const cleanRecebedor = String(analysis.cnpjRecebedor || "").replace(/\D/g, "");
              const dataPag = analysis.dataPagamento ? new Date(analysis.dataPagamento) : now;
              const dataVenc = analysis.dataVencimento ? new Date(analysis.dataVencimento) : dataPag;

              // =========================================================================
              // Deduplicação & Unificação Inteligente
              // =========================================================================
              let existingPayable: any = null;

              // 1. Busca por anexo já vinculado a um título
              const attMatch = await prisma.attachment.findFirst({
                where: { nomeOriginal: fileName, payableId: { not: null } },
                include: { payable: true },
              });
              if (attMatch?.payable) {
                existingPayable = attMatch.payable;
                // Garante que o anexo antigo receba o conteudoBase64 se não tinha
                if (!attMatch.conteudoBase64) {
                  await prisma.attachment.update({
                    where: { id: attMatch.id },
                    data: { conteudoBase64: base64Content },
                  });
                }
              }

              // 2. Busca por termos-chave (Sicredi, INSS, Unimed, Contabilidade, etc.)
              if (!existingPayable) {
                const normSearch = `${contextSubject} ${fileName} ${analysis.descricao}`.toLowerCase();
                const keywords = ["sicredi", "inss", "unimed", "contabilidade", "distribuicao", "distribuição", "5428"];
                const matchedKey = keywords.find((k) => normSearch.includes(k));

                if (matchedKey) {
                  existingPayable = await prisma.payable.findFirst({
                    where: {
                      OR: [
                        { descricao: { contains: matchedKey, mode: "insensitive" } },
                        { fornecedorNome: { contains: matchedKey, mode: "insensitive" } },
                      ],
                      dataCompetencia: {
                        gte: new Date(now.getFullYear(), now.getMonth(), 1),
                        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
                      },
                    },
                    include: { anexos: true },
                  });
                }
              }

              // 3. Busca por valor (+- 0.50) se valor > 0
              if (!existingPayable && analysis.valor > 0) {
                existingPayable = await prisma.payable.findFirst({
                  where: {
                    valorOriginal: { gte: analysis.valor - 0.5, lte: analysis.valor + 0.5 },
                    dataCompetencia: {
                      gte: new Date(now.getFullYear(), now.getMonth(), 1),
                      lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
                    },
                  },
                  include: { anexos: true },
                });
              }

              // CASO A: Título já existia no sistema -> Atualiza valor e anexa
              if (existingPayable) {
                const valorAtual = analysis.valor > 0 ? analysis.valor : existingPayable.valorOriginal;

                // Anexa o documento com conteudoBase64 persistido no banco
                const att = await prisma.attachment.create({
                  data: {
                    categoria: analysis.categoriaAnexo,
                    nomeOriginal: fileName,
                    nomeArquivo: uniqueFileName,
                    caminho: filePath,
                    conteudoBase64: base64Content,
                    mimeType,
                    tamanho: buffer.length,
                    competencia,
                    payableId: existingPayable.id,
                  },
                });

                const isComprovante = analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO";

                await prisma.payable.update({
                  where: { id: existingPayable.id },
                  data: {
                    valorOriginal: valorAtual,
                    valorPago: isComprovante || existingPayable.status === "PAGO" ? valorAtual : existingPayable.valorPago,
                    status: isComprovante ? "PAGO" : existingPayable.status,
                    dataPagamento: isComprovante ? dataPag : existingPayable.dataPagamento,
                    linhaDigitavel: analysis.linhaDigitavel || existingPayable.linhaDigitavel,
                  },
                });

                if (isComprovante) {
                  await prisma.paymentRecord.create({
                    data: {
                      tipo: "PAGAMENTO",
                      payableId: existingPayable.id,
                      data: dataPag,
                      valor: valorAtual,
                      formaPagamento: "PIX",
                      comprovanteAnexoId: att.id,
                      observacoes: `Comprovante importado (${contextSubject})`,
                    },
                  });
                  result.baixasEfetuadas++;
                }

                result.itensAtualizados = (result.itensAtualizados || 0) + 1;
                detalhesItens.push(
                  `Título atualizado com anexo persistido: ${existingPayable.descricao} (R$ ${valorAtual.toFixed(2)})`
                );
              }
              // CASO B: Novo lançamento financeiro
              else {
                if (cleanRecebedor === companyCnpjClean) {
                  const rec = await prisma.receivable.create({
                    data: {
                      descricao: analysis.descricao || `Recebimento: ${contextSubject}`,
                      clienteNome: analysis.nomePagador || "Cliente Identificado via E-mail",
                      clienteCpfCnpj: analysis.cnpjPagador || null,
                      categoria: "SERVICOS",
                      numeroNf: analysis.numeroDocumento || null,
                      valorOriginal: analysis.valor,
                      dataCompetencia: now,
                      dataVencimento: dataVenc,
                      status: analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO" ? "RECEBIDO" : "PENDENTE",
                      origem: "EMAIL_IA",
                    },
                  });

                  await prisma.attachment.create({
                    data: {
                      categoria: analysis.categoriaAnexo,
                      nomeOriginal: fileName,
                      nomeArquivo: uniqueFileName,
                      caminho: filePath,
                      conteudoBase64: base64Content,
                      mimeType,
                      tamanho: buffer.length,
                      competencia,
                      receivableId: rec.id,
                    },
                  });

                  result.contasReceberCriadas++;
                  detalhesItens.push(`Conta a Receber lançada: ${rec.descricao} (R$ ${rec.valorOriginal.toFixed(2)})`);
                } else {
                  const isJaPago = analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO";

                  const pay = await prisma.payable.create({
                    data: {
                      descricao: analysis.descricao || contextSubject,
                      fornecedorNome: analysis.nomeRecebedor || "Fornecedor Identificado no Documento",
                      fornecedorCpfCnpj: analysis.cnpjRecebedor || null,
                      categoria: analysis.categoriaAnexo === "BOLETO" ? "BOLETO" : "OUTROS",
                      numeroDocumento: analysis.numeroDocumento || null,
                      linhaDigitavel: analysis.linhaDigitavel || null,
                      chavePix: analysis.chavePix || null,
                      valorOriginal: analysis.valor,
                      valorPago: isJaPago ? analysis.valor : 0,
                      dataCompetencia: now,
                      dataVencimento: isJaPago ? dataPag : dataVenc,
                      dataPagamento: isJaPago ? dataPag : null,
                      status: isJaPago ? "PAGO" : "PENDENTE",
                      origem: "EMAIL_IA",
                    },
                  });

                  const att = await prisma.attachment.create({
                    data: {
                      categoria: analysis.categoriaAnexo,
                      nomeOriginal: fileName,
                      nomeArquivo: uniqueFileName,
                      caminho: filePath,
                      conteudoBase64: base64Content,
                      mimeType,
                      tamanho: buffer.length,
                      competencia,
                      payableId: pay.id,
                    },
                  });

                  if (isJaPago) {
                    await prisma.paymentRecord.create({
                      data: {
                        tipo: "PAGAMENTO",
                        payableId: pay.id,
                        data: dataPag,
                        valor: analysis.valor,
                        formaPagamento: "PIX",
                        comprovanteAnexoId: att.id,
                        observacoes: `Comprovante importado (${contextSubject})`,
                      },
                    });
                    result.baixasEfetuadas++;
                  }

                  result.contasPagarCriadas++;
                  detalhesItens.push(
                    `Conta a Pagar lançada (${pay.status}): ${pay.descricao} (R$ ${pay.valorOriginal.toFixed(2)})`
                  );
                }
              }
            } catch (anexoErr: any) {
              await addAuditLog(
                "IA_EXTRACAO",
                "ERROR",
                `Falha ao processar anexo ${fileName}`,
                anexoErr.message,
                anexoErr.stack
              );
              result.erros.push(`Erro no anexo ${fileName}: ${anexoErr.message}`);
            }
          }

          try {
            await client.messageFlagsAdd({ uid: item.uid }, ["\\Seen"]);
          } catch {}

          await prisma.emailSyncLog.create({
            data: {
              messageId: item.messageId,
              from: emailFrom,
              subject: emailSubject,
              data: parsed.date || now,
              totalAnexos: totalAnexosMsg,
              status: result.erros.length === 0 ? "SUCESSO" : "PARCIAL",
              resultadoIa: "Processado e Anexos Persistidos em Cloud SQL",
              itensCriados: detalhesItens.join("; ") || "Nenhum documento financeiro extraído",
            },
          });
        }
      } finally {
        lock.release();
      }
    }

    // =========================================================================
    // ETAPA 3: Limpeza de títulos duplicados com valor zerado
    // =========================================================================
    try {
      const allPayables = await prisma.payable.findMany({
        orderBy: { createdAt: "asc" },
        include: { anexos: true },
      });

      const seenMap = new Map<string, string>();
      for (const item of allPayables) {
        const firstAtt = item.anexos?.[0]?.nomeOriginal?.toLowerCase() || "";
        const descKey = item.descricao.toLowerCase().replace(/[^a-z0-9]/g, "");
        const key = firstAtt ? `att_${firstAtt}` : `desc_${descKey}_${item.status}`;

        if (seenMap.has(key)) {
          const originalId = seenMap.get(key)!;
          // Se o item duplicado tem anexos, transfere para o original
          if (item.anexos && item.anexos.length > 0) {
            for (const a of item.anexos) {
              await prisma.attachment.update({
                where: { id: a.id },
                data: { payableId: originalId },
              });
            }
          }
          await prisma.payable.delete({ where: { id: item.id } });
          result.duplicadosRemovidos = (result.duplicadosRemovidos || 0) + 1;
        } else {
          seenMap.set(key, item.id);
        }
      }

      if ((result.duplicadosRemovidos || 0) > 0) {
        await addAuditLog(
          "GMAIL_SYNC",
          "SUCCESS",
          "Limpeza de Duplicidades Concluída",
          `Total de ${result.duplicadosRemovidos} lançamentos duplicados consolidados com sucesso.`
        );
      }
    } catch (cleanErr: any) {
      await addAuditLog("GMAIL_SYNC", "WARN", "Aviso na limpeza de duplicidades", cleanErr.message);
    }
  } catch (error: any) {
    await addAuditLog(
      "GMAIL_SYNC",
      "ERROR",
      "Falha Crítica na Conexão com o Gmail",
      error.message,
      error.stack
    );
    result.erros.push(`Falha na conexão IMAP: ${error.message}`);
  } finally {
    try {
      await client.logout();
    } catch {}
  }

  await addAuditLog(
    "GMAIL_SYNC",
    result.erros.length === 0 ? "SUCCESS" : "WARN",
    "Sincronização Finalizada",
    `E-mails lidos: ${result.totalEmailsProcessados} | Anexos: ${result.totalAnexosProcessados} | Contas Pagar: ${result.contasPagarCriadas} | Baixas: ${result.baixasEfetuadas} | Atualizados: ${result.itensAtualizados} | Duplicados Removidos: ${result.duplicadosRemovidos}`,
    result
  );

  return result;
}
