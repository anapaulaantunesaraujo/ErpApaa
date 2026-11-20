import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import {
  analyzeFinancialDocumentWithAI,
  advancedHeuristicDocumentParser,
} from "./ai-document-analyzer";
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

/**
 * Busca e extrai um anexo diretamente do Gmail via IMAP quando o arquivo não estiver em disco.
 */
export async function fetchAttachmentBufferFromGmail(
  targetFileName: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  const settings = await prisma.companySettings.findFirst();
  const user = process.env.GMAIL_USER || settings?.emailUser || "apaaerp@gmail.com";
  const pass = process.env.GMAIL_APP_PASS || settings?.emailPass || "fgut uliz evis bqdm";
  const host = process.env.IMAP_HOST || settings?.emailHost || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || settings?.emailPort || 993);

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

  try {
    await client.connect();
    const mailboxes = await client.list();
    const candidateFolders: string[] = [];

    for (const mb of mailboxes) {
      const p = mb.path.toLowerCase();
      const n = mb.name.toLowerCase();
      if (
        n === "financeiro" ||
        p === "financeiro" ||
        p.endsWith("/financeiro") ||
        p.includes("salvos") ||
        p.includes("comprovantes")
      ) {
        if (!candidateFolders.includes(mb.path)) candidateFolders.push(mb.path);
      }
    }

    const inboxMb = mailboxes.find((mb) => mb.path.toUpperCase() === "INBOX" || mb.name.toUpperCase() === "INBOX");
    if (inboxMb && !candidateFolders.includes(inboxMb.path)) candidateFolders.push(inboxMb.path);

    const cleanTargetName = targetFileName.toLowerCase().trim();

    for (const folderPath of candidateFolders) {
      let lock;
      try {
        lock = await client.getMailboxLock(folderPath);
      } catch {
        continue;
      }

      try {
        const total = client.mailbox ? client.mailbox.exists : 0;
        if (total === 0) continue;

        const startSeq = Math.max(1, total - 25);
        const messagesCursor = client.fetch(`${startSeq}:*`, { uid: true, envelope: true });

        for await (const msg of messagesCursor) {
          const full = await client.fetchOne(msg.uid, { source: true }, { uid: true });
          if (!full || !full.source) continue;

          const parsed: any = await simpleParser(full.source);
          const allAttachments = await extrairTodosOsAnexos(parsed);

          for (const att of allAttachments) {
            const attNameLower = att.fileName.toLowerCase().trim();
            if (
              attNameLower === cleanTargetName ||
              attNameLower.includes(cleanTargetName) ||
              cleanTargetName.includes(attNameLower)
            ) {
              return {
                buffer: att.buffer,
                mimeType: att.mimeType,
                fileName: att.fileName,
              };
            }
          }
        }
      } finally {
        lock.release();
      }
    }
  } catch (err: any) {
    console.error("Erro ao buscar anexo no Gmail:", err.message);
  } finally {
    try {
      await client.logout();
    } catch {}
  }

  return null;
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
  const MAX_EXECUTION_TIME_MS = 38_000;

  // Garante a coluna conteudoBase64 na tabela de anexos para persistência definitiva no Cloud Run
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
  await fs.mkdir(uploadDir, { recursive: true });

  const now = new Date();
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // =========================================================================
  // ETAPA 1: Auto-recuperação dos arquivos e preenchimento dos valores zerados
  // =========================================================================
  try {
    const zeroPayables = await prisma.payable.findMany({
      where: { valorOriginal: 0 },
      include: { anexos: true },
    });

    for (const p of zeroPayables) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) break;

      if (p.anexos && p.anexos.length > 0) {
        for (const att of p.anexos) {
          let buf: Buffer | null = null;

          // 1. Tenta recuperar do campo conteudoBase64 do banco
          if (att.conteudoBase64) {
            buf = Buffer.from(att.conteudoBase64, "base64");
          }

          // 2. Tenta recuperar do disco local
          if (!buf) {
            const possiblePaths = [
              att.caminho,
              path.join(uploadDir, att.nomeArquivo),
              path.join(process.cwd(), "public", "uploads", "anexos", att.nomeArquivo),
              path.join("/tmp", "uploads", "anexos", att.nomeArquivo),
            ];
            for (const pth of possiblePaths) {
              try {
                buf = await fs.readFile(pth);
                break;
              } catch {}
            }
          }

          // 3. Se não estiver em disco nem no banco, busca no Gmail
          if (!buf && att.nomeOriginal) {
            const fetched = await fetchAttachmentBufferFromGmail(att.nomeOriginal);
            if (fetched) {
              buf = fetched.buffer;
              // Salva em disco e no banco para acesso instantâneo
              try {
                const diskPath = path.join(uploadDir, att.nomeArquivo);
                await fs.writeFile(diskPath, buf);
                await prisma.attachment.update({
                  where: { id: att.id },
                  data: { conteudoBase64: buf.toString("base64"), caminho: diskPath },
                });
              } catch {}
            }
          }

          if (buf) {
            const reAnalysis = advancedHeuristicDocumentParser(buf, att.mimeType, att.nomeOriginal, p.descricao);
            if (reAnalysis.valor > 0) {
              await prisma.payable.update({
                where: { id: p.id },
                data: {
                  valorOriginal: reAnalysis.valor,
                  valorPago: p.status === "PAGO" ? reAnalysis.valor : p.valorPago,
                  linhaDigitavel: reAnalysis.linhaDigitavel || p.linhaDigitavel,
                  fornecedorNome: p.fornecedorNome.includes("Identificado")
                    ? reAnalysis.nomeRecebedor || p.fornecedorNome
                    : p.fornecedorNome,
                },
              });
              result.itensAtualizados = (result.itensAtualizados || 0) + 1;
              break;
            }
          }
        }
      }
    }

    // Limpeza de duplicidades de registros anteriores
    const allPayables = await prisma.payable.findMany({
      orderBy: { createdAt: "asc" },
      include: { anexos: true },
    });

    const seenEntries = new Map<string, string>();
    for (const item of allPayables) {
      // Normaliza identificador (por nome de anexo ou descrição limpa)
      const firstAtt = item.anexos?.[0]?.nomeOriginal?.toLowerCase() || "";
      const descClean = item.descricao.toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = firstAtt ? `att_${firstAtt}` : `desc_${descClean}_${item.status}`;

      if (seenEntries.has(key)) {
        const originalId = seenEntries.get(key)!;
        // Transfere anexos para o registro original
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
        seenEntries.set(key, item.id);
      }
    }
  } catch (cleanErr: any) {
    console.warn("Aviso na etapa de auto-recuperação:", cleanErr.message);
  }

  // =========================================================================
  // ETAPA 2: Conexão IMAP e Processamento de Novos E-mails
  // =========================================================================
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

    for (const folderPath of candidateFolders) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) break;

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

        const startSeq = Math.max(1, totalMsgs - 19);
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

          if (processedMessageIdsInRun.has(msgId)) continue;

          // Se já existe log no banco, só processa se houver títulos zerados que necessitem reanálise
          const existingLog = await prisma.emailSyncLog.findFirst({
            where: { messageId: msgId },
          });

          if (!existingLog) {
            messagesToProcess.push({ uid: msg.uid, messageId: msgId });
          }
        }

        for (const item of messagesToProcess) {
          if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) break;

          processedMessageIdsInRun.add(item.messageId);

          const fullMsg = await client.fetchOne(item.uid, { source: true }, { uid: true });
          if (!fullMsg || !fullMsg.source) continue;

          result.totalEmailsProcessados++;
          const parsed: any = await simpleParser(fullMsg.source);
          const emailSubject = parsed.subject || "Sem assunto";
          let totalAnexosMsg = 0;
          const detalhesItens: string[] = [];

          const todosOsAnexos = await extrairTodosOsAnexos(parsed);

          for (const anexoItem of todosOsAnexos) {
            result.totalAnexosProcessados++;
            totalAnexosMsg++;

            const buffer = anexoItem.buffer;
            const fileName = anexoItem.fileName;
            const mimeType = anexoItem.mimeType;
            const contextSubject = anexoItem.contextSubject || emailSubject;

            const safeOriginalName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
            const uniqueFileName = `${Date.now()}_${safeOriginalName}`;
            const filePath = path.join(uploadDir, uniqueFileName);
            await fs.writeFile(filePath, buffer);

            const base64Content = buffer.toString("base64");

            try {
              const analysis = await analyzeFinancialDocumentWithAI(
                buffer,
                mimeType,
                fileName,
                settings?.geminiApiKey || undefined,
                contextSubject
              );

              const cleanRecebedor = String(analysis.cnpjRecebedor || "").replace(/\D/g, "");
              const dataPag = analysis.dataPagamento ? new Date(analysis.dataPagamento) : now;
              const dataVenc = analysis.dataVencimento ? new Date(analysis.dataVencimento) : dataPag;

              let existingPayable: any = null;

              // Busca título existente para vincular (sem duplicar!)
              const attMatch = await prisma.attachment.findFirst({
                where: { nomeOriginal: fileName, payableId: { not: null } },
                include: { payable: true },
              });
              if (attMatch?.payable) {
                existingPayable = attMatch.payable;
              }

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

              // CASO A: Título já existia no sistema
              if (existingPayable) {
                if (analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO") {
                  const valorReal = analysis.valor > 0 ? analysis.valor : existingPayable.valorOriginal;

                  const att = await prisma.attachment.create({
                    data: {
                      categoria: "COMPROVANTE",
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

                  await prisma.paymentRecord.create({
                    data: {
                      tipo: "PAGAMENTO",
                      payableId: existingPayable.id,
                      data: dataPag,
                      valor: valorReal,
                      formaPagamento: "PIX",
                      comprovanteAnexoId: att.id,
                      observacoes: `Comprovante importado (${contextSubject})`,
                    },
                  });

                  await prisma.payable.update({
                    where: { id: existingPayable.id },
                    data: {
                      valorOriginal: existingPayable.valorOriginal > 0 ? existingPayable.valorOriginal : valorReal,
                      valorPago: valorReal,
                      status: "PAGO",
                      dataPagamento: dataPag,
                    },
                  });

                  result.baixasEfetuadas++;
                  detalhesItens.push(
                    `Comprovante anexado ao título existente: ${existingPayable.descricao} (R$ ${valorReal.toFixed(2)})`
                  );
                } else {
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
                      payableId: existingPayable.id,
                    },
                  });

                  if (existingPayable.valorOriginal === 0 && analysis.valor > 0) {
                    await prisma.payable.update({
                      where: { id: existingPayable.id },
                      data: {
                        valorOriginal: analysis.valor,
                        linhaDigitavel: analysis.linhaDigitavel || existingPayable.linhaDigitavel,
                      },
                    });
                  }
                  detalhesItens.push(`Documento anexado ao título existente: ${existingPayable.descricao}`);
                }
              }
              // CASO B: Novo título
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
                        observacoes: `Comprovante importado do e-mail (${contextSubject})`,
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
              result.erros.push(`Erro ao processar anexo ${fileName}: ${anexoErr.message}`);
            }
          }

          try {
            await client.messageFlagsAdd({ uid: item.uid }, ["\\Seen"]);
          } catch {}

          await prisma.emailSyncLog.create({
            data: {
              messageId: item.messageId,
              from: parsed.from?.text || "Desconhecido",
              subject: emailSubject,
              data: parsed.date || now,
              totalAnexos: totalAnexosMsg,
              status: result.erros.length === 0 ? "SUCESSO" : "PARCIAL",
              resultadoIa: "Processado com Extrator Nativo e Armazenamento Durável",
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
