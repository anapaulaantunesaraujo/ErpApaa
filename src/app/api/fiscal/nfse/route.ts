import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const items = await prisma.nfseEmission.findMany({
      include: {
        cliente: true,
        servico: true,
        receivable: true,
      },
      orderBy: {
        dataEmissao: "desc",
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao listar notas fiscais emitidas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar notas fiscais emitidas." },
      { status: 500 }
    );
  }
}

