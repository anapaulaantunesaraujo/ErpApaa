import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateReconciliationExcelBuffer, ReconciliationRow } from "@/lib/services/reconciliation-excel";
import { generateMonthlyClosingZip, ClosingFileEntry } from "@/lib/services/monthly-closing-zip";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { destinatario, assunto, mensagem, mes, ano } = body;

    if (!destinatario || !mes || !ano) {
      return NextResponse.json(
        { error: "Destinatário, mês e ano são obrigatórios." },
        { status: 400 }
      );
    }

    const mesNum = parseInt(String(mes), 10);
    const anoNum = parseInt(String(ano), 10);
    const competencia = `${anoNum}-${String(mesNum).padStart(2, "0")}`;

    // 1. Gera o Excel de conciliação do período
    const statement = await prisma.bankStatement.findFirst({
      where: { mes: mesNum, ano: anoNum },
      include: {
        anexos: true,
        transacoes: {
          include: {
            payable: true,
            receivable: true,
          },
          orderBy: { data: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const saldoAnterior = statement ? statement.saldoInicial : 0;
    const itens: ReconciliationRow[] = [];

    if (statement && statement.transacoes.length > 0) {
      for (const t of statement.transacoes) {
        const nf = t.receivable?.numeroNf || t.payable?.numeroDocumento || t.numeroDocumento || "";
        itens.push({
          data: t.data,
          nf: nf || undefined,
          descricao: t.descricao,
          valor: t.valor,
          saldo: t.saldo || 0,
        });
      }
    }

    const excelBuffer = await generateReconciliationExcelBuffer({
      tituloPeriodo: `${String(mesNum).padStart(2, "0")}/${anoNum}`,
      saldoAnterior,
      itens,
    });

    // 2. Coleta anexos do período
    const extratoFiles: ClosingFileEntry[] = [];
    if (statement && statement.anexos) {
      for (const a of statement.anexos) {
        extratoFiles.push({ name: a.nomeOriginal, path: a.caminho });
      }
    }

    const nfsEmitidasFiles: ClosingFileEntry[] = [];
    const receivablesAttachments = await prisma.attachment.findMany({
      where: { receivableId: { not: null }, categoria: "DOCUMENTO", competencia },
    });
    for (const a of receivablesAttachments) {
      nfsEmitidasFiles.push({ name: a.nomeOriginal, path: a.caminho });
    }

    const boletosNfsPagarFiles: ClosingFileEntry[] = [];
    const payablesDocs = await prisma.attachment.findMany({
      where: { payableId: { not: null }, categoria: { in: ["BOLETO", "DOCUMENTO"] }, competencia },
    });
    for (const a of payablesDocs) {
      boletosNfsPagarFiles.push({ name: a.nomeOriginal, path: a.caminho });
    }

    const comprovantesFiles: ClosingFileEntry[] = [];
    const comprovantes = await prisma.attachment.findMany({
      where: { categoria: "COMPROVANTE", competencia },
    });
    for (const a of comprovantes) {
      comprovantesFiles.push({ name: a.nomeOriginal, path: a.caminho });
    }

    // 3. Empacota o arquivo ZIP
    const zipBuffer = await generateMonthlyClosingZip({
      ano: anoNum,
      mes: mesNum,
      excelBuffer,
      extratoFiles,
      nfsEmitidasFiles,
      boletosNfsPagarFiles,
      comprovantesFiles,
    });

    const mesStr = String(mesNum).padStart(2, "0");
    const zipFileName = `Fechamento_APAA_${anoNum}_${mesStr}.zip`;

    // 4. Configuração do transporte SMTP
    const settings = await prisma.companySettings.findFirst();
    const smtpHost = process.env.SMTP_HOST || settings?.emailHost;
    const smtpPort = Number(process.env.SMTP_PORT || settings?.emailPort || 587);
    const smtpUser = process.env.SMTP_USER || settings?.emailUser;
    const smtpPass = process.env.SMTP_PASS || settings?.emailPass;

    if (!smtpHost || !smtpUser) {
      return NextResponse.json({
        success: false,
        warning: true,
        message:
          "Arquivo ZIP gerado com sucesso! Para enviar diretamente pelo servidor SMTP, cadastre os dados de host/senha de e-mail nas configurações.",
        downloadUrl: `/api/financeiro/fechamento/zip?mes=${mesNum}&ano=${anoNum}`,
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass || undefined,
      },
    });

    const remetenteNome = user.name || "APAA Treinamento";
    const remetenteEmail = user.email || smtpUser;

    await transporter.sendMail({
      from: `"${remetenteNome}" <${smtpUser}>`,
      replyTo: remetenteEmail,
      to: destinatario,
      subject: assunto || `Fechamento Contábil e Financeiro - APAA Treinamento (${mesStr}/${anoNum})`,
      text:
        mensagem ||
        `Olá,\n\nSegue em anexo o arquivo compactado (${zipFileName}) contendo a planilha de conciliação bancária do período ${mesStr}/${anoNum} e as respectivas pastas organizadas (Extrato, NFs emitidas, Boletos e NFs a pagar, e Comprovantes de pagamento).\n\nAtenciosamente,\n${remetenteNome}\nAPAA Treinamento`,
      attachments: [
        {
          filename: zipFileName,
          content: zipBuffer,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: `E-mail enviado com sucesso para ${destinatario} com o anexo ${zipFileName}.`,
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail de fechamento:", error);
    return NextResponse.json(
      { error: "Erro ao enviar e-mail com o fechamento mensal." },
      { status: 500 }
    );
  }
}
