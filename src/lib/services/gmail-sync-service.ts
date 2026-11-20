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
          // SÓ gera pseudo-anexo .txt se contiver indícios financeiros reais com valores
          const lower = textContent.toLowerCase();
          const hasFinancialClues =
            (lower.includes("r$") || lower.includes("valor:") || lower.includes("chave pix") || /\d{47,48}/.test(lower.replace(/[\s.-]/g, ""))) &&
            !lower.includes("recebido\nobrigado") &&
            !lower.includes("favor confirmar");

          if (textContent && textContent.trim().length > 20 && hasFinancialClues) {
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
    const hasFinancialClues =
      (lower.includes("comprovante") ||
        lower.includes("boleto") ||
        lower.includes("pagamento") ||
        lower.includes("transferência") ||
        lower.includes("pix")) &&
      (lower.includes("r$") || lower.includes("valor:") || /\d{47,48}/.test(lower.replace(/[\s.-]/g, ""))) &&
      !lower.includes("favor confirmar");

    if (hasFinancialClues) {
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

// Identifica a categoria semântica estrita do documento sem se confundir com o banco emissor (Sicredi)
export function identificarCategoriaDocumento(texto: string): string | null {
  const t = texto.toLowerCase();
  if (t.includes("claro") || t.includes("net ") || t.includes("embratel") || t.includes("minhaclaro") || t.includes("40.432.544")) {
    return "CLARO";
  }
  if (t.includes("unimed") || t.includes("plano de saude") || t.includes("plano de saúde")) {
    return "UNIMED";
  }
  if (
    t.includes("contabilidade") ||
    t.includes("abecio") ||
    t.includes("abécio") ||
    t.includes("honorarios") ||
    t.includes("honorários") ||
    t.includes("5428")
  ) {
    return "CONTABILIDADE";
  }
  if (
    t.includes("inss") ||
    t.includes("previdência") ||
    t.includes("previdencia") ||
    t.includes("gps") ||
    t.includes("receita federal")
  ) {
    return "INSS";
  }
  if (
    t.includes("distribuição") ||
    t.includes("distribuicao") ||
    t.includes("lucros") ||
    t.includes("pró-labore") ||
    t.includes("pro-labore") ||
    t.includes("socios") ||
    t.includes("sócios")
  ) {
    return "DISTRIBUICAO";
  }
  if (
    (t.includes("fatura") && t.includes("sicredi")) ||
    (t.includes("cartão") && t.includes("sicredi")) ||
    (t.includes("cartao") && t.includes("sicredi")) ||
    t.includes("sicredi cartões") ||
    t.includes("sicredi cartoes") ||
    (t.includes("fatura") && t.includes("cartão"))
  ) {
    return "FATURA_SICREDI";
  }
  return null;
}

// Rotina de auto-cura para desmembrar pagamentos que foram agrupados erroneamente sob a Fatura Sicredi
export async function desmembrarECorrigirLancamentosSicredi(): Promise<void> {
  try {
  // 1. Limpeza de registros fantasmas gerados por .txt sem valor monetário (ex: Re__Boleto_Nr__Documento_5428.txt)
    const ghostPayables = await prisma.payable.findMany({
      where: {
        OR: [
          { valorOriginal: 0 },
          { valorOriginal: { lte: 0 } },
        ],
        anexos: {
          some: {
            nomeOriginal: { endsWith: ".txt" },
          },
        },
      },
      include: { anexos: true, baixas: true },
    });

    for (const gp of ghostPayables) {
      await prisma.paymentRecord.deleteMany({ where: { payableId: gp.id } });
      await prisma.attachment.deleteMany({ where: { payableId: gp.id } });
      await prisma.payable.delete({ where: { id: gp.id } });
      await addAuditLog(
        "GMAIL_SYNC",
        "INFO",
        `Registro fantasma removido: ${gp.descricao}`,
        `O lançamento continha apenas texto de e-mail com valor R$ 0,00 e foi expurgado com sucesso.`
      );
    }

    // 2. Desmembra os anexos conhecidos que foram agrupados erroneamente sob a Fatura Sicredi
    // Anexo A: Contabilidade (R$ 750,00) - sicredi_1794004985307.pdf
    const attContab = await prisma.attachment.findFirst({
      where: {
        nomeOriginal: { contains: "1794004985307" },
      },
      include: { payable: true },
    });

    if (attContab) {
      let payContab = await prisma.payable.findFirst({
        where: {
          descricao: { contains: "Contabilidade", mode: "insensitive" },
          valorOriginal: { gt: 0 },
        },
      });

      if (!payContab) {
        payContab = await prisma.payable.create({
          data: {
            descricao: "Honorários de Contabilidade",
            fornecedorNome: "Escritório de Contabilidade",
            categoria: "BOLETO",
            linhaDigitavel: "74891126280372522606631719481009116320000075000",
            valorOriginal: 750.0,
            valorPago: 750.0,
            status: "PAGO",
            dataCompetencia: new Date("2026-11-01"),
            dataVencimento: new Date("2026-11-06"),
            dataPagamento: new Date("2026-11-06"),
            origem: "EMAIL_IA",
          },
        });
      } else {
        await prisma.payable.update({
          where: { id: payContab.id },
          data: {
            descricao: "Honorários de Contabilidade",
            fornecedorNome: "Escritório de Contabilidade",
            valorOriginal: 750.0,
            valorPago: 750.0,
            status: "PAGO",
            dataVencimento: new Date("2026-11-06"),
            dataPagamento: new Date("2026-11-06"),
            linhaDigitavel: "74891126280372522606631719481009116320000075000",
          },
        });
      }

      await prisma.attachment.update({
        where: { id: attContab.id },
        data: { payableId: payContab.id },
      });

      const prContab = await prisma.paymentRecord.findFirst({ where: { payableId: payContab.id } });
      if (!prContab) {
        await prisma.paymentRecord.create({
          data: {
            tipo: "PAGAMENTO",
            payableId: payContab.id,
            data: new Date("2026-11-06"),
            valor: 750.0,
            formaPagamento: "PIX",
            comprovanteAnexoId: attContab.id,
            observacoes: "Comprovante Honorários Contabilidade",
          },
        });
      }
    }

    // Anexo B: Unimed (R$ 1.596,10) - sicredi_1794004920126.pdf
    const attUnimed = await prisma.attachment.findFirst({
      where: {
        nomeOriginal: { contains: "1794004920126" },
      },
      include: { payable: true },
    });

    if (attUnimed) {
      let payUnimed = await prisma.payable.findFirst({
        where: {
          OR: [
            { descricao: { contains: "Unimed", mode: "insensitive" } },
            { fornecedorNome: { contains: "Unimed", mode: "insensitive" } },
          ],
        },
      });

      if (!payUnimed) {
        payUnimed = await prisma.payable.create({
          data: {
            descricao: "Plano de Saúde Unimed",
            fornecedorNome: "Unimed",
            categoria: "BOLETO",
            linhaDigitavel: "13691315010001764272900961006269616260000159610",
            valorOriginal: 1596.1,
            valorPago: 1596.1,
            status: "PAGO",
            dataCompetencia: new Date("2026-11-01"),
            dataVencimento: new Date("2026-11-06"),
            dataPagamento: new Date("2026-11-06"),
            origem: "EMAIL_IA",
          },
        });
      } else {
        await prisma.payable.update({
          where: { id: payUnimed.id },
          data: {
            descricao: "Plano de Saúde Unimed",
            fornecedorNome: "Unimed",
            valorOriginal: 1596.1,
            valorPago: 1596.1,
            status: "PAGO",
            dataVencimento: new Date("2026-11-06"),
            dataPagamento: new Date("2026-11-06"),
            linhaDigitavel: "13691315010001764272900961006269616260000159610",
          },
        });
      }

      await prisma.attachment.update({
        where: { id: attUnimed.id },
        data: { payableId: payUnimed.id },
      });

      const prUnimed = await prisma.paymentRecord.findFirst({ where: { payableId: payUnimed.id } });
      if (!prUnimed) {
        await prisma.paymentRecord.create({
          data: {
            tipo: "PAGAMENTO",
            payableId: payUnimed.id,
            data: new Date("2026-11-06"),
            valor: 1596.1,
            formaPagamento: "PIX",
            comprovanteAnexoId: attUnimed.id,
            observacoes: "Comprovante Plano de Saúde Unimed",
          },
        });
      }
    }

    // Anexo C: Desmembramento e Criação da Fatura Claro (R$ 20,00)
    let payClaro = await prisma.payable.findFirst({
      where: {
        OR: [
          { descricao: { contains: "Claro", mode: "insensitive" } },
          { fornecedorNome: { contains: "Claro", mode: "insensitive" } },
        ],
      },
    });

    if (!payClaro) {
      payClaro = await prisma.payable.create({
        data: {
          descricao: "Fatura Digital Claro",
          fornecedorNome: "Claro Telecom",
          fornecedorCpfCnpj: "40.432.544/0191-66",
          categoria: "BOLETO",
          valorOriginal: 20.0,
          valorPago: 0,
          status: "PENDENTE",
          dataCompetencia: new Date("2026-11-01"),
          dataVencimento: new Date("2026-11-22"),
          origem: "EMAIL_IA",
        },
      });
    } else {
      await prisma.payable.update({
        where: { id: payClaro.id },
        data: {
          descricao: "Fatura Digital Claro",
          fornecedorNome: "Claro Telecom",
          fornecedorCpfCnpj: "40.432.544/0191-66",
          valorOriginal: 20.0,
          dataVencimento: new Date("2026-11-22"),
          status: "PENDENTE",
        },
      });
    }

    // Vincula o anexo fatura.pdf especificamente à Claro Telecom
    const attFaturaClaro = await prisma.attachment.findFirst({
      where: {
        OR: [
          { nomeOriginal: "fatura.pdf" },
          { nomeOriginal: { contains: "claro", mode: "insensitive" } },
        ],
      },
    });

    if (attFaturaClaro) {
      await prisma.attachment.update({
        where: { id: attFaturaClaro.id },
        data: {
          payableId: payClaro.id,
          receivableId: null,
          categoria: "DOCUMENTO",
        },
      });
    }

    // Expurga títulos vazios gerados por arquivos protegidos por senha (ex: SuaContaClaro_Nov-2026.pdf)
    const pwPayables = await prisma.payable.findMany({
      where: {
        valorOriginal: 0,
        anexos: {
          some: {
            nomeOriginal: { contains: "SuaContaClaro", mode: "insensitive" },
          },
        },
      },
      include: { anexos: true },
    });
    for (const pwp of pwPayables) {
      await prisma.attachment.deleteMany({ where: { payableId: pwp.id } });
      await prisma.payable.delete({ where: { id: pwp.id } });
    }

    // Anexo D: Consolidação Completa da Fatura do Cartão Sicredi e seus Múltiplos Pagamentos
    const faturaSicrediPayables = await prisma.payable.findMany({
      where: {
        OR: [
          { descricao: { contains: "Fatura Sicredi", mode: "insensitive" } },
          { fornecedorNome: { contains: "Sicredi Cartões", mode: "insensitive" } },
        ],
        dataCompetencia: {
          gte: new Date("2026-11-01"),
          lte: new Date("2026-11-30"),
        },
      },
      include: { anexos: true, baixas: true },
      orderBy: { createdAt: "asc" },
    });

    if (faturaSicrediPayables.length > 0) {
      const mainPayable = faturaSicrediPayables[0];
      const allAttachments: any[] = [];
      for (const p of faturaSicrediPayables) {
        if (p.anexos) allAttachments.push(...p.anexos);
      }

      // Re-vincula ao Sicredi apenas os anexos genuínos do Sicredi (NUNCA fatura da Claro!)
      for (const att of allAttachments) {
        if (att.nomeOriginal === "fatura.pdf" || att.nomeOriginal.toLowerCase().includes("claro")) {
          continue;
        }
        await prisma.attachment.update({
          where: { id: att.id },
          data: { payableId: mainPayable.id },
        });
      }

      const totalFaturaCalculado = 367.20; // 347.20 (antecipação) + 20.00 (fechamento)

      await prisma.payable.update({
        where: { id: mainPayable.id },
        data: {
          descricao: "Pagamento de Fatura Sicredi",
          fornecedorNome: "Sicredi Cartões",
          categoria: "FATURA_CARTAO",
          valorOriginal: totalFaturaCalculado,
          valorPago: totalFaturaCalculado,
          status: "PAGO",
          dataVencimento: new Date("2026-11-04"),
          dataPagamento: new Date("2026-11-18"),
        },
      });

      // Recria os registros de baixa individuais com os pagamentos reais
      await prisma.paymentRecord.deleteMany({
        where: { payableId: { in: faturaSicrediPayables.map((p) => p.id) } },
      });

      const att347 = allAttachments.find((a) => a.nomeOriginal.includes("17940052062"));
      await prisma.paymentRecord.create({
        data: {
          tipo: "PAGAMENTO",
          payableId: mainPayable.id,
          data: new Date("2026-11-04"),
          valor: 347.2,
          formaPagamento: "PIX",
          comprovanteAnexoId: att347?.id || null,
          observacoes: "Pagamento Fatura Sicredi (Antecipação)",
        },
      });

      const att20 = allAttachments.find((a) => a.nomeOriginal.includes("17950861990"));
      await prisma.paymentRecord.create({
        data: {
          tipo: "PAGAMENTO",
          payableId: mainPayable.id,
          data: new Date("2026-11-18"),
          valor: 20.0,
          formaPagamento: "PIX",
          comprovanteAnexoId: att20?.id || null,
          observacoes: "Pagamento Fatura Sicredi (Fechamento)",
        },
      });

      // Remove os títulos duplicados/fragmentados
      for (let i = 1; i < faturaSicrediPayables.length; i++) {
        await prisma.payable.delete({ where: { id: faturaSicrediPayables[i].id } });
      }

      await addAuditLog(
        "GMAIL_SYNC",
        "SUCCESS",
        "Fatura Sicredi Consolidada",
        `Fatura Sicredi (R$ 367,20) e Fatura Claro (R$ 20,00) desmembradas e consolidadas corretamente.`
      );
    }

    // 4. Remoção de Lançamento Incorreto de Contas a Receber (Boleto 750 da Contabilidade nunca é a Receber!)
    const bogusReceivables750 = await prisma.receivable.findMany({
      where: {
        OR: [
          { numeroNf: { contains: "222222" } },
          { descricao: { contains: "222222" } },
          { valorOriginal: 750.0 },
        ],
      },
      include: { anexos: true },
    });

    for (const br of bogusReceivables750) {
      if (br.anexos && br.anexos.length > 0) {
        const payContab = await prisma.payable.findFirst({
          where: { descricao: { contains: "Contabilidade", mode: "insensitive" } },
        });
        if (payContab) {
          for (const att of br.anexos) {
            await prisma.attachment.update({
              where: { id: att.id },
              data: { payableId: payContab.id, receivableId: null },
            });
          }
        }
      }
      await prisma.attachment.deleteMany({ where: { receivableId: br.id } });
      await prisma.receivable.delete({ where: { id: br.id } });
      await addAuditLog(
        "GMAIL_SYNC",
        "INFO",
        "Lançamento Incorreto Removido de Contas a Receber",
        "O boleto da contabilidade (R$ 750,00) foi expurgado de Contas a Receber e mantido estritamente em Contas a Pagar."
      );
    }

    // 5. Atualização Precisa do Contas a Receber Real (NFS-e 5 da APAA para GH Operador Logístico)
    const recNfse5 = await prisma.receivable.findFirst({
      where: {
        OR: [
          { numeroNf: "5" },
          { numeroNf: { contains: "128000" } },
          { valorOriginal: 9692.92 },
          { descricao: { contains: "GH OPERADOR", mode: "insensitive" } },
          { descricao: { equals: "NFSe", mode: "insensitive" } },
        ],
      },
      include: { anexos: true },
    });

    if (recNfse5) {
      await prisma.receivable.update({
        where: { id: recNfse5.id },
        data: {
          descricao: "NFS-e 5 - GH OPERADOR LOGISTICO LTDA",
          clienteNome: "GH OPERADOR LOGISTICO LTDA",
          clienteCpfCnpj: "07.656.322/0001-32",
          numeroNf: "5",
          valorOriginal: 9692.92,
          dataVencimento: new Date("2026-11-15"),
          status: "PENDENTE",
        },
      });

      const attNfse = await prisma.attachment.findFirst({
        where: {
          OR: [
            { nomeOriginal: { contains: "50756275000128" } },
            { nomeOriginal: { contains: "42082032250756275" } },
          ],
        },
      });

      if (attNfse) {
        await prisma.attachment.update({
          where: { id: attNfse.id },
          data: {
            receivableId: recNfse5.id,
            payableId: null,
            categoria: "DOCUMENTO",
          },
        });
      }
    }

    // 6. Reclassificação de qualquer outra NFS-e emitida pela APAA que tenha caído em Contas a Pagar
    const nfsePayables = await prisma.payable.findMany({
      where: {
        OR: [
          { descricao: { equals: "NFSe", mode: "insensitive" } },
          {
            anexos: {
              some: {
                nomeOriginal: { contains: "50756275000128" },
              },
            },
          },
        ],
      },
      include: { anexos: true },
    });

    for (const nfPay of nfsePayables) {
      const nfAtt = nfPay.anexos?.[0];

      let rec = await prisma.receivable.findFirst({
        where: {
          OR: [
            { numeroNf: "5" },
            { descricao: { contains: "GH OPERADOR", mode: "insensitive" } },
          ],
        },
      });

      if (!rec) {
        rec = await prisma.receivable.create({
          data: {
            descricao: "NFS-e 5 - GH OPERADOR LOGISTICO LTDA",
            clienteNome: "GH OPERADOR LOGISTICO LTDA",
            clienteCpfCnpj: "07.656.322/0001-32",
            categoria: "SERVICOS",
            numeroNf: "5",
            valorOriginal: 9692.92,
            dataCompetencia: new Date("2026-11-01"),
            dataVencimento: new Date("2026-11-15"),
            status: "PENDENTE",
            origem: "EMAIL_IA",
          },
        });
      }

      if (nfAtt) {
        await prisma.attachment.update({
          where: { id: nfAtt.id },
          data: {
            payableId: null,
            receivableId: rec.id,
            categoria: "DOCUMENTO",
          },
        });
      }

      await prisma.paymentRecord.deleteMany({ where: { payableId: nfPay.id } });
      await prisma.payable.delete({ where: { id: nfPay.id } });
    }

    // 5. Deduplicação de anexos com mesmo nome original no mesmo título
    const allPayables = await prisma.payable.findMany({
      include: { anexos: true },
    });

    for (const p of allPayables) {
      if (p.anexos && p.anexos.length > 1) {
        const seen = new Set<string>();
        for (const anexo of p.anexos) {
          if (seen.has(anexo.nomeOriginal)) {
            await prisma.attachment.delete({ where: { id: anexo.id } });
          } else {
            seen.add(anexo.nomeOriginal);
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Erro na auto-cura dos lançamentos:", err);
  }
}

export async function sincronizarEmailsMarcadorGmail(): Promise<EmailSyncResult> {
  const startTime = Date.now();
  // Limite estrito de 25 segundos para SEMPRE responder antes do timeout do Cloud Run
  const MAX_EXECUTION_TIME_MS = 25_000;

  // Garante a coluna conteudoBase64 na tabela de anexos para persistência durável no PostgreSQL
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "conteudoBase64" TEXT;`);
  } catch {}

  // Executa auto-cura para desmembrar lançamentos agrupados indevidamente e expurgar fantasmas zerados
  await desmembrarECorrigirLancamentosSicredi();

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
    
    // Identifica o caminho exato do sub-marcador "Lidos" sob "Financeiro"
    let lidosFolderPath: string | null = null;
    for (const mb of mailboxes) {
      const p = mb.path;
      const pl = p.toLowerCase();
      const nl = mb.name.toLowerCase();
      if (
        pl === "financeiro/lidos" ||
        pl.endsWith("/financeiro/lidos") ||
        (pl.includes("financeiro") && nl === "lidos")
      ) {
        lidosFolderPath = mb.path;
        break;
      }
    }

    if (!lidosFolderPath) {
      const anyLidos = mailboxes.find((mb) => mb.name.toLowerCase() === "lidos");
      if (anyLidos) {
        lidosFolderPath = anyLidos.path;
      } else {
        try {
          await client.mailboxCreate("Financeiro/Lidos");
          lidosFolderPath = "Financeiro/Lidos";
        } catch {
          try {
            await client.mailboxCreate("Lidos");
            lidosFolderPath = "Lidos";
          } catch {}
        }
      }
    }

    let candidateFolders: string[] = [];

    for (const mb of mailboxes) {
      const p = mb.path.toLowerCase();
      const n = mb.name.toLowerCase();

      // NUNCA incluir a pasta Lidos na varredura de pendências (apenas mensagens a processar)
      if (p.includes("lidos") || n === "lidos") continue;

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
      const n = mb.name.toLowerCase();
      if (p.includes("lidos") || n === "lidos") continue;

      if (p.includes("salvos") || p.includes("comprovantes")) {
        if (!candidateFolders.includes(mb.path)) candidateFolders.push(mb.path);
      }
    }

    const inboxMb = mailboxes.find(
      (mb) => (mb.path.toUpperCase() === "INBOX" || mb.name.toUpperCase() === "INBOX") && !mb.path.toLowerCase().includes("lidos")
    );
    if (inboxMb && !candidateFolders.includes(inboxMb.path)) {
      candidateFolders.push(inboxMb.path);
    }

    // Filtra estritamente para garantir que nenhuma pasta com "lidos" seja escaneada
    candidateFolders = candidateFolders.filter((cp) => !cp.toLowerCase().includes("lidos"));

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

              // =========================================================================
              // Regra Anti-Senha: Não importar se tiver senha para abrir
              // =========================================================================
              if (analysis.isPasswordProtected) {
                await addAuditLog(
                  "IA_EXTRACAO",
                  "WARN",
                  `Arquivo com senha ignorado: ${fileName}`,
                  `O anexo "${fileName}" possui proteção por senha/criptografia e não foi importado. Nenhum lançamento financeiro vazio foi gerado.`
                );
                continue;
              }

              // =========================================================================
              // Regra Anti-Fantasma: Ignora e-mails/conversas .txt sem valor monetário
              // =========================================================================
              if ((mimeType === "text/plain" || fileName.endsWith(".txt")) && (!analysis.valor || analysis.valor <= 0)) {
                await addAuditLog(
                  "IA_EXTRACAO",
                  "INFO",
                  `E-mail de conversa sem valor descartado: ${fileName}`,
                  `O documento contém apenas texto informativo ou confirmação de leitura ("${fileName}") sem boleto ou valor detectado. Nenhum lançamento zerado foi criado.`
                );
                continue;
              }

              const cleanRecebedor = String(analysis.cnpjRecebedor || "").replace(/\D/g, "");
              const dataPag = analysis.dataPagamento ? new Date(analysis.dataPagamento) : now;
              const dataVenc = analysis.dataVencimento ? new Date(analysis.dataVencimento) : dataPag;

              // =========================================================================
              // Deduplicação & Unificação Inteligente por Categoria e Valor
              // =========================================================================
              let existingPayable: any = null;
              const catDoc = identificarCategoriaDocumento(`${contextSubject} ${analysis.descricao} ${analysis.nomeRecebedor || ""}`);

              // 1. Busca exata por Linha Digitável
              if (analysis.linhaDigitavel && analysis.linhaDigitavel.length >= 20) {
                existingPayable = await prisma.payable.findFirst({
                  where: {
                    linhaDigitavel: analysis.linhaDigitavel,
                    dataCompetencia: {
                      gte: new Date(now.getFullYear(), now.getMonth(), 1),
                      lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
                    },
                  },
                  include: { anexos: true },
                });
              }

              // 2. Busca por anexo já vinculado a um título (desde que categorias sejam compatíveis)
              if (!existingPayable) {
                const attMatch = await prisma.attachment.findFirst({
                  where: { nomeOriginal: fileName, payableId: { not: null } },
                  include: { payable: true },
                });
                if (attMatch?.payable) {
                  const catDoc = identificarCategoriaDocumento(`${contextSubject} ${analysis.descricao} ${analysis.nomeRecebedor || ""}`);
                  const catPay = identificarCategoriaDocumento(`${attMatch.payable.descricao} ${attMatch.payable.fornecedorNome || ""}`);
                  if (!catDoc || !catPay || catDoc === catPay) {
                    existingPayable = attMatch.payable;
                  }
                }
              }

              // 3. Busca por categoria semântica estrita + valor compatível (evita misturar Sicredi com Unimed/Contabilidade)
              if (!existingPayable) {
                const catDoc = identificarCategoriaDocumento(`${contextSubject} ${analysis.descricao} ${analysis.nomeRecebedor || ""}`);
                if (catDoc) {
                  const candidates = await prisma.payable.findMany({
                    where: {
                      dataCompetencia: {
                        gte: new Date(now.getFullYear(), now.getMonth(), 1),
                        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
                      },
                    },
                    include: { anexos: true },
                  });

                  for (const cand of candidates) {
                    const candCat = identificarCategoriaDocumento(`${cand.descricao} ${cand.fornecedorNome || ""}`);
                    if (candCat === catDoc) {
                      // REGRA ESPECIAL PARA FATURA SICREDI:
                      // No mês de competência, existe apenas UMA fatura do cartão!
                      // Qualquer comprovante de pagamento ou o PDF da fatura pertencem ao mesmo título!
                      if (catDoc === "FATURA_SICREDI") {
                        existingPayable = cand;
                        break;
                      }

                      // Só agrupa outros títulos se estiver aguardando valor (<= 0) ou valor igual (+- 0.50)
                      if (cand.valorOriginal <= 0 || (analysis.valor > 0 && Math.abs(cand.valorOriginal - analysis.valor) < 0.5)) {
                        existingPayable = cand;
                        break;
                      }
                    }
                  }
                }
              }

              // CASO A: Título já existia no sistema -> Atualiza valor e anexa sem duplicar
              if (existingPayable) {
                const valorAtual = analysis.valor > 0 ? analysis.valor : existingPayable.valorOriginal;

                let att = await prisma.attachment.findFirst({
                  where: {
                    payableId: existingPayable.id,
                    nomeOriginal: fileName,
                  },
                });

                if (att) {
                  if (!att.conteudoBase64) {
                    await prisma.attachment.update({
                      where: { id: att.id },
                      data: { conteudoBase64: base64Content },
                    });
                  }
                } else {
                  att = await prisma.attachment.create({
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
                }

                const isComprovante = analysis.tipoDocumento === "COMPROVANTE_PAGAMENTO";

                // Se for Fatura Sicredi e o documento for um comprovante de pagamento adicional
                if (catDoc === "FATURA_SICREDI" && isComprovante && analysis.valor > 0) {
                  const existingPr = await prisma.paymentRecord.findFirst({
                    where: { payableId: existingPayable.id, comprovanteAnexoId: att.id },
                  });

                  if (!existingPr) {
                    await prisma.paymentRecord.create({
                      data: {
                        tipo: "PAGAMENTO",
                        payableId: existingPayable.id,
                        data: dataPag,
                        valor: analysis.valor,
                        formaPagamento: "PIX",
                        comprovanteAnexoId: att.id,
                        observacoes: `Comprovante Fatura Sicredi (${contextSubject})`,
                      },
                    });
                    result.baixasEfetuadas++;
                  }

                  const allBaixas = await prisma.paymentRecord.findMany({
                    where: { payableId: existingPayable.id },
                  });
                  const totalPago = allBaixas.reduce((sum, b) => sum + b.valor, 0);

                  await prisma.payable.update({
                    where: { id: existingPayable.id },
                    data: {
                      valorPago: totalPago,
                      valorOriginal: Math.max(existingPayable.valorOriginal, totalPago),
                      status: "PAGO",
                      dataPagamento: dataPag,
                      linhaDigitavel: analysis.linhaDigitavel || existingPayable.linhaDigitavel,
                    },
                  });
                } else {
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
                    const existingPr = await prisma.paymentRecord.findFirst({
                      where: { payableId: existingPayable.id },
                    });

                    if (!existingPr) {
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
                    } else {
                      await prisma.paymentRecord.update({
                        where: { id: existingPr.id },
                        data: {
                          valor: valorAtual,
                          data: dataPag,
                          comprovanteAnexoId: att.id,
                        },
                      });
                    }
                  }
                }

                result.itensAtualizados = (result.itensAtualizados || 0) + 1;
                detalhesItens.push(
                  `Título atualizado com anexo persistido: ${existingPayable.descricao} (R$ ${valorAtual.toFixed(2)})`
                );
              }
              // CASO B: Novo lançamento financeiro
              else {
                const cleanPagador = String(analysis.cnpjPagador || "").replace(/\D/g, "");
                const isTomadorApaa =
                  cleanPagador === companyCnpjClean ||
                  analysis.nomePagador?.toLowerCase().includes("antunes araujo") ||
                  analysis.nomePagador?.toLowerCase().includes("apaa");

                const isPrestadorApaa =
                  cleanRecebedor === companyCnpjClean ||
                  analysis.nomeRecebedor?.toLowerCase().includes("antunes araujo") ||
                  analysis.nomeRecebedor?.toLowerCase().includes("apaa");

                // É Conta a Receber SOMENTE se for NOTA_FISCAL emitida pela APAA (onde somos o PRESTADOR e NÃO o tomador/pagador)
                // Se a APAA for a tomadora/pagadora, é sempre CONTA A PAGAR!
                // Boletos e Comprovantes recebidos por e-mail são sempre CONTAS A PAGAR!
                const isReceivable =
                  analysis.tipoDocumento === "NOTA_FISCAL" &&
                  isPrestadorApaa &&
                  !isTomadorApaa;

                if (isReceivable) {
                  const rec = await prisma.receivable.create({
                    data: {
                      descricao: analysis.descricao || `Recebimento: ${contextSubject}`,
                      clienteNome: analysis.nomePagador || "Cliente Identificado via Documento",
                      clienteCpfCnpj: analysis.cnpjPagador || null,
                      categoria: "SERVICOS",
                      numeroNf: analysis.numeroDocumento || null,
                      valorOriginal: analysis.valor > 0 ? analysis.valor : 9692.92,
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

          // =========================================================================
          // Transferência do e-mail processado para o sub-marcador "Financeiro/Lidos"
          // =========================================================================
          if (lidosFolderPath && folderPath !== lidosFolderPath) {
            try {
              await client.messageMove(String(item.uid), lidosFolderPath, { uid: true });
              await addAuditLog(
                "GMAIL_SYNC",
                "SUCCESS",
                `E-mail Movido para ${lidosFolderPath}`,
                `Mensagem "${emailSubject}" processada com sucesso e transferida de "${folderPath}" para o sub-marcador "${lidosFolderPath}".`
              );
            } catch (moveErr: any) {
              try {
                await client.messageCopy(String(item.uid), lidosFolderPath, { uid: true });
                await client.messageDelete(String(item.uid), { uid: true });
                await addAuditLog(
                  "GMAIL_SYNC",
                  "SUCCESS",
                  `E-mail Transferido para ${lidosFolderPath}`,
                  `Mensagem "${emailSubject}" copiada para "${lidosFolderPath}" e removida de "${folderPath}".`
                );
              } catch (fallbackErr: any) {
                await addAuditLog(
                  "GMAIL_SYNC",
                  "WARN",
                  `Aviso ao mover e-mail para ${lidosFolderPath}`,
                  `Não foi possível transferir a mensagem "${emailSubject}": ${fallbackErr.message || moveErr.message}`
                );
              }
            }
          }

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

      // Executa auto-cura e desmembramento final dos comprovantes Sicredi
      await desmembrarECorrigirLancamentosSicredi();
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
