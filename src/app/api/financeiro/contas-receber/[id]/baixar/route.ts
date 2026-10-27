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
      dataRecebimento,
      valorRecebido,
      valorJuros = 0,
      valorMulta = 0,
      valorDesconto = 0,
      formaPagamento = "PIX",
      observacoes,
      comprovanteAnexoId,
    } = body;

    if (!valorRecebido || !dataRecebimento) {
      return NextResponse.json(
        { error: "Valor e data de recebimento são obrigatórios." },
        { status: 400 }
      );
    }

    const receivable = await prisma.receivable.findUnique({
      where: { id },
    });

    if (!receivable) {
      return NextResponse.json({ error: "Conta a receber não encontrada." }, { status: 404 });
    }

    const valorRecebidoNum = Number(valorRecebido);
    const jurosNum = Number(valorJuros);
    const multaNum = Number(valorMulta);
    const descontoNum = Number(valorDesconto);

    const novoTotalRecebido = receivable.valorRecebido + valorRecebidoNum;
    const valorTotalEsperado = receivable.valorOriginal + jurosNum + multaNum - descontoNum;
    const novoStatus = novoTotalRecebido >= valorTotalEsperado ? "RECEBIDO" : "PARCIAL";

    const [paymentRecord, updatedReceivable] = await prisma.$transaction([
      prisma.paymentRecord.create({
        data: {
          tipo: "RECEBIMENTO",
          receivableId: id,
          data: new Date(dataRecebimento),
          valor: valorRecebidoNum,
          valorJuros: jurosNum,
          valorMulta: multaNum,
          valorDesconto: descontoNum,
          formaPagamento,
          observacoes,
          comprovanteAnexoId,
        },
      }),
      prisma.receivable.update({
        where: { id },
        data: {
          valorRecebido: novoTotalRecebido,
          valorJuros: receivable.valorJuros + jurosNum,
          valorMulta: receivable.valorMulta + multaNum,
          valorDesconto: receivable.valorDesconto + descontoNum,
          dataRecebimento: new Date(dataRecebimento),
          status: novoStatus,
        },
        include: {
          anexos: true,
          baixas: true,
        },
      }),
    ]);

    return NextResponse.json({ success: true, item: updatedReceivable, baixa: paymentRecord });
  } catch (error) {
    console.error("Erro ao registrar baixa de conta a receber:", error);
    return NextResponse.json({ error: "Erro ao processar baixa." }, { status: 500 });
  }
}

