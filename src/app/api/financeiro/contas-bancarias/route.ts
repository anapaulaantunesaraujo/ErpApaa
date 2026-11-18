import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const contas = await prisma.bankAccount.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        creditCards: true,
      },
    });

    // Calcula saldo real projetado por conta bancária:
    // Saldo Inicial + Total Recebimentos Baixados - Total Pagamentos Baixados
    const contasComSaldo = await Promise.all(
      contas.map(async (c) => {
        const recebimentos = await prisma.receivable.aggregate({
          where: {
            bankAccountId: c.id,
            status: "RECEBIDO",
          },
          _sum: {
            valorRecebido: true,
          },
        });

        const pagamentos = await prisma.payable.aggregate({
          where: {
            bankAccountId: c.id,
            status: "PAGO",
          },
          _sum: {
            valorPago: true,
          },
        });

        const totalEntradas = recebimentos._sum.valorRecebido || 0;
        const totalSaidas = pagamentos._sum.valorPago || 0;
        const saldoCalculado = c.saldoInicial + totalEntradas - totalSaidas;

        return {
          ...c,
          totalEntradas,
          totalSaidas,
          saldoCalculado,
        };
      })
    );

    return NextResponse.json({ items: contasComSaldo });
  } catch (error: any) {
    console.error("Erro ao listar contas bancárias:", error);
    return NextResponse.json({ error: "Erro ao buscar contas bancárias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { banco, agencia, conta, descricao, tipo = "CORRENTE", saldoInicial = 0, cor = "#0B3D91" } = body;

    if (!banco || !agencia || !conta || !descricao) {
      return NextResponse.json(
        { error: "Banco, agência, conta e descrição são obrigatórios." },
        { status: 400 }
      );
    }

    const sInicial = parseFloat(String(saldoInicial)) || 0;

    const novaConta = await prisma.bankAccount.create({
      data: {
        banco,
        agencia,
        conta,
        descricao,
        tipo,
        saldoInicial: sInicial,
        saldoAtual: sInicial,
        cor,
        ativo: true,
      },
    });

    return NextResponse.json({ success: true, item: novaConta });
  } catch (error: any) {
    console.error("Erro ao cadastrar conta bancária:", error);
    return NextResponse.json({ error: "Erro ao cadastrar conta bancária." }, { status: 500 });
  }
}
