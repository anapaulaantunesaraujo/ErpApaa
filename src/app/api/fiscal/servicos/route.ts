import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const servicos = await prisma.companyService.findMany({
      where: { ativo: true },
      orderBy: { descricao: "asc" },
    });
    return NextResponse.json({ items: servicos });
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    return NextResponse.json({ error: "Erro ao buscar serviços fiscais." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      codigo,
      descricao,
      cnae,
      codigoTributacaoNacional,
      itemLc116,
      aliquotaIss = 2.0,
      retencaoIss = false,
      aliquotaPis = 0,
      aliquotaCofins = 0,
      aliquotaInss = 0,
      aliquotaIr = 0,
      aliquotaCsll = 0,
      valorPadrao,
    } = body;

    if (!descricao || !cnae || !codigoTributacaoNacional) {
      return NextResponse.json(
        { error: "Descrição, CNAE e Código de Tributação Nacional são obrigatórios." },
        { status: 400 }
      );
    }

    const servico = await prisma.companyService.create({
      data: {
        codigo,
        descricao,
        cnae,
        codigoTributacaoNacional,
        itemLc116,
        aliquotaIss: Number(aliquotaIss),
        retencaoIss: Boolean(retencaoIss),
        aliquotaPis: Number(aliquotaPis),
        aliquotaCofins: Number(aliquotaCofins),
        aliquotaInss: Number(aliquotaInss),
        aliquotaIr: Number(aliquotaIr),
        aliquotaCsll: Number(aliquotaCsll),
        valorPadrao: valorPadrao ? Number(valorPadrao) : null,
      },
    });

    return NextResponse.json({ success: true, item: servico });
  } catch (error) {
    console.error("Erro ao cadastrar serviço fiscal:", error);
    return NextResponse.json({ error: "Erro ao cadastrar serviço fiscal." }, { status: 500 });
  }
}

