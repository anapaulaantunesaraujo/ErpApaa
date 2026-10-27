import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateReconciliationExcelBuffer, ReconciliationRow } from "@/lib/services/reconciliation-excel";
import { generateMonthlyClosingZip, ClosingFileEntry } from "@/lib/services/monthly-closing-zip";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mesParam = searchParams.get("mes");
  const anoParam = searchParams.get("ano");

  const now = new Date();
  const mes = mesParam ? parseInt(mesParam, 10) : now.getMonth() + 1;
  const ano = anoParam ? parseInt(anoParam, 10) : now.getFullYear();
  const competencia = `${ano}-${String(mes).padStart(2, "0")}`;

  try {
    // 1. Busca os dados de extrato e transações para a planilha Excel
    const statement = await prisma.bankStatement.findFirst({
      where: { mes, ano },
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
      tituloPeriodo: `${String(mes).padStart(2, "0")}/${ano}`,
      saldoAnterior,
      itens,
    });

    // 2. Coleta os arquivos de cada pasta
    // Pasta "Extrato" (os 3 arquivos do extrato: .ofx, .txt, .pdf)
    const extratoFiles: ClosingFileEntry[] = [];
    if (statement && statement.anexos) {
      for (const a of statement.anexos) {
        extratoFiles.push({ name: a.nomeOriginal, path: a.caminho });
      }
    }

    // Pasta "NFs emitidas" (documentos de contas a receber do mês)
    const nfsEmitidasFiles: ClosingFileEntry[] = [];
    const receivablesAttachments = await prisma.attachment.findMany({
      where: {
        receivableId: { not: null },
        categoria: "DOCUMENTO",
        competencia,
      },
    });
    for (const a of receivablesAttachments) {
      nfsEmitidasFiles.push({ name: a.nomeOriginal, path: a.caminho });
    }

    // Pasta "Boletos e NFs a pagar" (boletos e NFs de despesas do mês)
    const boletosNfsPagarFiles: ClosingFileEntry[] = [];
    const payablesDocs = await prisma.attachment.findMany({
      where: {
        payableId: { not: null },
        categoria: { in: ["BOLETO", "DOCUMENTO"] },
        competencia,
      },
    });
    for (const a of payablesDocs) {
      boletosNfsPagarFiles.push({ name: a.nomeOriginal, path: a.caminho });
    }

    // Pasta "Comprovantes" (comprovantes bancários de pagamento do mês)
    const comprovantesFiles: ClosingFileEntry[] = [];
    const comprovantes = await prisma.attachment.findMany({
      where: {
        categoria: "COMPROVANTE",
        competencia,
      },
    });
    for (const a of comprovantes) {
      comprovantesFiles.push({ name: a.nomeOriginal, path: a.caminho });
    }

    // 3. Monta o pacote ZIP
    const zipBuffer = await generateMonthlyClosingZip({
      ano,
      mes,
      excelBuffer,
      extratoFiles,
      nfsEmitidasFiles,
      boletosNfsPagarFiles,
      comprovantesFiles,
    });

    const mesStr = String(mes).padStart(2, "0");
    const zipFileName = `Fechamento_APAA_${ano}_${mesStr}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar ZIP de fechamento:", error);
    return NextResponse.json(
      { error: "Erro ao gerar arquivo compactado de fechamento." },
      { status: 500 }
    );
  }
}
