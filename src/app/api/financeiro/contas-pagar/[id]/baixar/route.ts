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
    } = body;

    if (!valorPago || !dataPagamento) {
      return NextResponse.json(
        { error: "Valor e data de pagamento são obrigatórios." },
        { status: 400 }
      );
    }

    const payable = await prisma.payable.findUnique({
      where: { id },
    });

    if (!payable) {
      return NextResponse.json({ error: "Conta a pagar não encontrada." }, { status: 404 });
    }

    const valorPagoNum = Number(valorPago);
    const jurosNum = Number(valorJuros);
    const multaNum = Number(valorMulta);
    const descontoNum = Number(valorDesconto);

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
          observacoes,
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

    return NextResponse.json({ success: true, item: updatedPayable, baixa: paymentRecord });
  } catch (error) {
    console.error("Erro ao registrar baixa de conta a pagar:", error);
    return NextResponse.json({ error: "Erro ao processar baixa." }, { status: 500 });
  }
}

