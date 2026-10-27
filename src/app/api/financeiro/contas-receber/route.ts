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
        { clienteNome: { contains: busca, mode: "insensitive" } },
        { descricao: { contains: busca, mode: "insensitive" } },
        { numeroNf: { contains: busca, mode: "insensitive" } },
      ];
    }
    if (competencia) {
      const [ano, mes] = competencia.split("-").map(Number);
      const dataInicio = new Date(ano, mes - 1, 1);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
      where.dataVencimento = { gte: dataInicio, lte: dataFim };
    }

    const receivables = await prisma.receivable.findMany({
      where,
      include: {
        anexos: true,
        baixas: true,
        nfseEmission: true,
      },
      orderBy: { dataVencimento: "asc" },
    });

    return NextResponse.json({ items: receivables });
  } catch (error) {
    console.error("Erro ao listar contas a receber:", error);
    return NextResponse.json({ error: "Erro ao buscar contas a receber." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      descricao,
      clienteNome,
      clienteCpfCnpj,
      clienteId,
      categoria,
      numeroNf,
      valorOriginal,
      dataCompetencia,
      dataVencimento,
      dataEmissao,
      observacoes,
    } = body;

    if (!descricao || !clienteNome || valorOriginal === undefined || !dataVencimento) {
      return NextResponse.json(
        { error: "Descrição, cliente, valor e vencimento são obrigatórios." },
        { status: 400 }
      );
    }

    const receivable = await prisma.receivable.create({
      data: {
        descricao,
        clienteNome,
        clienteCpfCnpj,
        clienteId,
        categoria: categoria || "SERVICOS",
        numeroNf,
        valorOriginal: Number(valorOriginal),
        dataCompetencia: dataCompetencia ? new Date(dataCompetencia) : new Date(dataVencimento),
        dataVencimento: new Date(dataVencimento),
        dataEmissao: dataEmissao ? new Date(dataEmissao) : null,
        observacoes,
        status: "PENDENTE",
        origem: "MANUAL",
      },
      include: {
        anexos: true,
      },
    });

    return NextResponse.json({ success: true, item: receivable });
  } catch (error) {
    console.error("Erro ao criar conta a receber:", error);
    return NextResponse.json({ error: "Erro ao cadastrar conta a receber." }, { status: 500 });
  }
}

