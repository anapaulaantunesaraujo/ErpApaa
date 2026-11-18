import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const cartoes = await prisma.creditCard.findMany({
      include: {
        bankAccount: true,
        faturas: {
          orderBy: [{ ano: "desc" }, { mes: "desc" }],
          take: 6,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const categorias = await prisma.expenseCategory.findMany({
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({ items: cartoes, categorias });
  } catch (error: any) {
    console.error("Erro ao listar cartões de crédito:", error);
    return NextResponse.json({ error: "Erro ao buscar cartões de crédito." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      nome,
      bandeira = "MASTERCARD",
      ultimosDigitos = "0000",
      limite = 0,
      diaFechamento = 1,
      diaVencimento = 10,
      bankAccountId,
    } = body;

    if (!nome) {
      return NextResponse.json({ error: "Nome do cartão é obrigatório." }, { status: 400 });
    }

    const novoCartao = await prisma.creditCard.create({
      data: {
        nome,
        bandeira,
        ultimosDigitos: String(ultimosDigitos).slice(-4),
        limite: parseFloat(String(limite)) || 0,
        diaFechamento: parseInt(String(diaFechamento), 10) || 1,
        diaVencimento: parseInt(String(diaVencimento), 10) || 10,
        bankAccountId: bankAccountId || null,
        ativo: true,
      },
      include: {
        bankAccount: true,
      },
    });

    return NextResponse.json({ success: true, item: novoCartao });
  } catch (error: any) {
    console.error("Erro ao cadastrar cartão de crédito:", error);
    return NextResponse.json({ error: "Erro ao cadastrar cartão de crédito." }, { status: 500 });
  }
}
