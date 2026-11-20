import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const competencia = searchParams.get("competencia"); // YYYY-MM
  const busca = searchParams.get("busca");

  try {
    const where: any = {};
    if (status && status !== "TODOS") {
      where.status = status;
    }
    if (busca) {
      where.OR = [
        { fornecedorNome: { contains: busca, mode: "insensitive" } },
        { descricao: { contains: busca, mode: "insensitive" } },
        { numeroDocumento: { contains: busca, mode: "insensitive" } },
      ];
    }
    if (competencia) {
      const [ano, mes] = competencia.split("-").map(Number);
      const dataInicio = new Date(ano, mes - 1, 1);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
      where.dataVencimento = { gte: dataInicio, lte: dataFim };
    }

    const payables = await prisma.payable.findMany({
      where,
      include: {
        anexos: true,
        baixas: true,
      },
      orderBy: { dataVencimento: "asc" },
    });

    return NextResponse.json({ items: payables });
  } catch (error) {
    console.error("Erro ao listar contas a pagar:", error);
    return NextResponse.json({ error: "Erro ao buscar contas a pagar." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      descricao,
      fornecedorNome,
      fornecedorCpfCnpj,
      fornecedorId,
      categoria,
      numeroDocumento,
      valorOriginal,
      dataCompetencia,
      dataVencimento,
      dataEmissao,
      linhaDigitavel,
      chavePix,
      observacoes,
    } = body;

    if (!descricao || !fornecedorNome || valorOriginal === undefined || !dataVencimento) {
      return NextResponse.json(
        { error: "Descrição, fornecedor, valor e vencimento são obrigatórios." },
        { status: 400 }
      );
    }

    const payable = await prisma.payable.create({
      data: {
        descricao,
        fornecedorNome,
        fornecedorCpfCnpj,
        fornecedorId,
        categoria: categoria || "GERAL",
        numeroDocumento,
        valorOriginal: Number(valorOriginal),
        dataCompetencia: dataCompetencia ? new Date(dataCompetencia) : new Date(dataVencimento),
        dataVencimento: new Date(dataVencimento),
        dataEmissao: dataEmissao ? new Date(dataEmissao) : null,
        linhaDigitavel,
        chavePix,
        observacoes,
        status: "PENDENTE",
        origem: "MANUAL",
      },
      include: {
        anexos: true,
      },
    });

    return NextResponse.json({ success: true, item: payable });
  } catch (error) {
    console.error("Erro ao criar conta a pagar:", error);
    return NextResponse.json({ error: "Erro ao cadastrar conta a pagar." }, { status: 500 });
  }
}

