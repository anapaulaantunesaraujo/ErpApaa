import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      dataPagamento,
      valorPago,
      valorJuros = 0,
      valorMulta = 0,
      valorDesconto = 0,
      formaPagamento = "PIX",
      observacoes,
      comprovanteAnexoId,
      cardId,
      totalParcelas = 1,
    } = body;

    if (!valorPago || !dataPagamento) {
      return NextResponse.json(
        { error: "Valor e data de pagamento são obrigatórios." },
        { status: 400 }
      );
    }

    const payable = await prisma.payable.findUnique({
      where: { id },
      include: { anexos: true },
    });

    if (!payable) {
      return NextResponse.json({ error: "Conta a pagar não encontrada." }, { status: 404 });
    }

    const valorPagoNum = Number(valorPago);
    const jurosNum = Number(valorJuros);
    const multaNum = Number(valorMulta);
    const descontoNum = Number(valorDesconto);
    const totalParcelasNum = Math.max(1, Number(totalParcelas) || 1);

    // Se a forma for Cartão de Crédito, identifica ou cria o cartão corporativo
    let card: any = null;
    let obsFinal = observacoes;
    if (formaPagamento === "CARTAO_CREDITO") {
      if (cardId) {
        card = await prisma.creditCard.findUnique({ where: { id: cardId } });
      }
      if (!card) {
        card = await prisma.creditCard.findFirst();
      }
      if (!card) {
        card = await prisma.creditCard.create({
          data: {
            nome: "Sicredi Mastercard Corporativo",
            bandeira: "MASTERCARD",
            ultimosDigitos: "0000",
            limite: 10000,
            diaFechamento: 1,
            diaVencimento: 10,
          },
        });
      }
      obsFinal =
        observacoes ||
        `Pago no Cartão de Crédito (${card.nome}) em ${totalParcelasNum}x`;
    }

    const novoTotalPago = payable.valorPago + valorPagoNum;
    const valorTotalEsperado = payable.valorOriginal + jurosNum + multaNum - descontoNum;
    const novoStatus = novoTotalPago >= valorTotalEsperado ? "PAGO" : "PARCIAL";

    const [paymentRecord, updatedPayable] = await prisma.$transaction([
      prisma.paymentRecord.create({
        data: {
          tipo: "PAGAMENTO",
          payableId: id,
          data: new Date(dataPagamento),
          valor: valorPagoNum,
          valorJuros: jurosNum,
          valorMulta: multaNum,
          valorDesconto: descontoNum,
          formaPagamento,
          observacoes: obsFinal,
          comprovanteAnexoId,
        },
      }),
      prisma.payable.update({
        where: { id },
        data: {
          valorPago: novoTotalPago,
          valorJuros: payable.valorJuros + jurosNum,
          valorMulta: payable.valorMulta + multaNum,
          valorDesconto: payable.valorDesconto + descontoNum,
          dataPagamento: new Date(dataPagamento),
          status: novoStatus,
        },
        include: {
          anexos: true,
          baixas: true,
        },
      }),
    ]);

    // Quando pago no cartão de crédito, gera os lançamentos de fatura correspondentes no cartão
    if (formaPagamento === "CARTAO_CREDITO" && card) {
      const valorBaseParcela = Number((valorPagoNum / totalParcelasNum).toFixed(2));
      const baseDate = new Date(dataPagamento);

      for (let p = 1; p <= totalParcelasNum; p++) {
        const expenseDate = new Date(baseDate);
        expenseDate.setMonth(expenseDate.getMonth() + (p - 1));

        // Ajusta a última parcela para soma exata do valor pago
        const valorRealParcela =
          p === totalParcelasNum
            ? Number((valorPagoNum - valorBaseParcela * (totalParcelasNum - 1)).toFixed(2))
            : valorBaseParcela;

        const expense = await prisma.cardExpense.create({
          data: {
            cardId: card.id,
            descricao:
              totalParcelasNum > 1
                ? `${payable.descricao} (${p}/${totalParcelasNum})`
                : payable.descricao,
            estabelecimento: payable.fornecedorNome,
            numeroNf: payable.numeroDocumento,
            valor: valorRealParcela,
            parcelaAtual: p,
            totalParcelas: totalParcelasNum,
            dataCompra: expenseDate,
            observacoes: `Origem: Conta a Pagar #${payable.id} (${payable.descricao})`,
          },
        });

        // Vincula anexos da conta a pagar à primeira parcela no cartão
        if (p === 1 && payable.anexos && payable.anexos.length > 0) {
          for (const att of payable.anexos) {
            await prisma.attachment.update({
              where: { id: att.id },
              data: { cardExpenseId: expense.id },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, item: updatedPayable, baixa: paymentRecord });
  } catch (error) {
    console.error("Erro ao registrar baixa de conta a pagar:", error);
    return NextResponse.json({ error: "Erro ao processar baixa." }, { status: 500 });
  }
}

