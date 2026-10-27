import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseOfx } from "@/lib/services/ofx-parser";
import path from "path";
import fs from "fs/promises";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mesParam = searchParams.get("mes");
  const anoParam = searchParams.get("ano");

  const now = new Date();
  const mes = mesParam ? parseInt(mesParam, 10) : now.getMonth() + 1;
  const ano = anoParam ? parseInt(anoParam, 10) : now.getFullYear();

  try {
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

    return NextResponse.json({ statement: statement || null });
  } catch (error) {
    console.error("Erro ao buscar extrato bancário:", error);
    return NextResponse.json({ error: "Erro ao buscar extrato." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const ofxFile = formData.get("ofxFile") as File | null;
    const txtFile = formData.get("txtFile") as File | null;
    const pdfFile = formData.get("pdfFile") as File | null;
    const mesParam = formData.get("mes");
    const anoParam = formData.get("ano");

    if (!ofxFile) {
      return NextResponse.json(
        { error: "O arquivo .ofx do extrato Sicredi é obrigatório." },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "extratos");
    await fs.mkdir(uploadDir, { recursive: true });

    // Lê o conteúdo do OFX para parse
    const ofxBuffer = Buffer.from(await ofxFile.arrayBuffer());
    const ofxText = ofxBuffer.toString("utf-8");
    const parsedOfx = parseOfx(ofxText);

    // Determina mês e ano de competência
    let mes = mesParam ? parseInt(String(mesParam), 10) : undefined;
    let ano = anoParam ? parseInt(String(anoParam), 10) : undefined;

    if (!mes || !ano) {
      const refDate = parsedOfx.startDate || (parsedOfx.transactions[0]?.date) || new Date();
      mes = refDate.getMonth() + 1;
      ano = refDate.getFullYear();
    }

    const competencia = `${ano}-${String(mes).padStart(2, "0")}`;

    // Totais de créditos e débitos
    let totalCreditos = 0;
    let totalDebitos = 0;
    for (const t of parsedOfx.transactions) {
      if (t.amount > 0) totalCreditos += t.amount;
      else totalDebitos += Math.abs(t.amount);
    }

    // Salva o registro do Extrato
    const statement = await prisma.bankStatement.create({
      data: {
        banco: "Sicredi",
        agencia: parsedOfx.bankId,
        conta: parsedOfx.accountNumber,
        mes,
        ano,
        dataInicio: parsedOfx.startDate,
        dataFim: parsedOfx.endDate,
        saldoInicial: parsedOfx.openingBalance || 0,
        saldoFinal: parsedOfx.closingBalance || 0,
        totalCreditos: parseFloat(totalCreditos.toFixed(2)),
        totalDebitos: parseFloat(totalDebitos.toFixed(2)),
      },
    });

    // Função para salvar arquivo físico e criar anexo
    const saveStatementFile = async (file: File, tag: string) => {
      const buf = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}_${tag}_${safeName}`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buf);

      return prisma.attachment.create({
        data: {
          categoria: "DOCUMENTO",
          nomeOriginal: file.name,
          nomeArquivo: fileName,
          caminho: filePath,
          mimeType: file.type || "application/octet-stream",
          tamanho: file.size,
          competencia,
          bankStatementId: statement.id,
        },
      });
    };

    // Salva os 3 arquivos
    await saveStatementFile(ofxFile, "OFX");
    if (txtFile) await saveStatementFile(txtFile, "TXT");
    if (pdfFile) await saveStatementFile(pdfFile, "PDF");

    // Salva cada transação bancária e tenta conciliação automática prévia
    let saldoLinha = parsedOfx.openingBalance || 0;
    for (const trn of parsedOfx.transactions) {
      saldoLinha = parseFloat((saldoLinha + trn.amount).toFixed(2));

      let matchedPayableId: string | null = null;
      let matchedReceivableId: string | null = null;
      let conciliado = false;

      const dataTransacao = new Date(trn.date);
      const margemDias = 5;
      const dataMin = new Date(dataTransacao.getTime() - margemDias * 86400000);
      const dataMax = new Date(dataTransacao.getTime() + margemDias * 86400000);

      if (trn.amount < 0) {
        // Débito -> tenta achar Contas a Pagar
        const valorDebito = Math.abs(trn.amount);
        const matchPayable = await prisma.payable.findFirst({
          where: {
            valorOriginal: { gte: valorDebito - 0.05, lte: valorDebito + 0.05 },
            dataVencimento: { gte: dataMin, lte: dataMax },
            conciliado: false,
          },
        });
        if (matchPayable) {
          matchedPayableId = matchPayable.id;
          conciliado = true;
          await prisma.payable.update({
            where: { id: matchPayable.id },
            data: { conciliado: true, dataConciliacao: dataTransacao },
          });
        }
      } else {
        // Crédito -> tenta achar Contas a Receber
        const valorCredito = trn.amount;
        const matchReceivable = await prisma.receivable.findFirst({
          where: {
            valorOriginal: { gte: valorCredito - 0.05, lte: valorCredito + 0.05 },
            dataVencimento: { gte: dataMin, lte: dataMax },
            conciliado: false,
          },
        });
        if (matchReceivable) {
          matchedReceivableId = matchReceivable.id;
          conciliado = true;
          await prisma.receivable.update({
            where: { id: matchReceivable.id },
            data: { conciliado: true, dataConciliacao: dataTransacao },
          });
        }
      }

      await prisma.bankTransaction.create({
        data: {
          statementId: statement.id,
          fitid: trn.fitid,
          tipo: trn.type,
          data: trn.date,
          descricao: trn.memo,
          valor: trn.amount,
          saldo: saldoLinha,
          numeroDocumento: trn.checkNumber,
          conciliado,
          payableId: matchedPayableId,
          receivableId: matchedReceivableId,
        },
      });
    }

    const completeStatement = await prisma.bankStatement.findUnique({
      where: { id: statement.id },
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
    });

    return NextResponse.json({
      success: true,
      statement: completeStatement,
      totalTransacoes: parsedOfx.transactions.length,
    });
  } catch (error) {
    console.error("Erro ao importar extrato:", error);
    return NextResponse.json(
      { error: "Erro ao processar os arquivos do extrato bancário." },
      { status: 500 }
    );
  }
}

