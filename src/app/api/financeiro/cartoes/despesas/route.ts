import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");
    const mes = searchParams.get("mes") ? parseInt(searchParams.get("mes")!, 10) : undefined;
    const ano = searchParams.get("ano") ? parseInt(searchParams.get("ano")!, 10) : undefined;

    const where: any = {};
    if (cardId) where.cardId = cardId;
    if (mes && ano) {
      where.invoice = { mes, ano };
    }

    const despesas = await prisma.cardExpense.findMany({
      where,
      include: {
        card: true,
        category: true,
        invoice: true,
        anexos: true,
      },
      orderBy: { dataCompra: "desc" },
    });

    // Mapeamento de Custos por Categoria (Analytics de economia)
    const agrupamentoCategorias: Record<string, { nome: string; cor: string; total: number; qtd: number }> = {};
    let totalGeral = 0;

    for (const d of despesas) {
      const catNome = d.category?.nome || "Outros Gastos";
      const catCor = d.category?.cor || "#64748B";
      if (!agrupamentoCategorias[catNome]) {
        agrupamentoCategorias[catNome] = { nome: catNome, cor: catCor, total: 0, qtd: 0 };
      }
      agrupamentoCategorias[catNome].total += d.valor;
      agrupamentoCategorias[catNome].qtd += 1;
      totalGeral += d.valor;
    }

    const rankingCategorias = Object.values(agrupamentoCategorias).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      items: despesas,
      analytics: {
        totalGeral,
        totalCompras: despesas.length,
        rankingCategorias,
      },
    });
  } catch (error: any) {
    console.error("Erro ao listar compras no cartão:", error);
    return NextResponse.json({ error: "Erro ao buscar despesas do cartão." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      cardId,
      descricao,
      estabelecimento,
      numeroNf,
      valor,
      dataCompra,
      categoryId,
      totalParcelas = 1,
      observacoes,
    } = body;

    if (!cardId || !descricao || !valor || !dataCompra) {
      return NextResponse.json(
        { error: "Cartão, descrição, valor e data da compra são obrigatórios." },
        { status: 400 }
      );
    }

    const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
    if (!card) return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });

    const dt = new Date(dataCompra);
    const diaCompra = dt.getDate();
    let mesFatura = dt.getMonth() + 1;
    let anoFatura = dt.getFullYear();

    // Se comprou após ou no dia do fechamento, entra na fatura do mês seguinte
    if (diaCompra >= card.diaFechamento) {
      mesFatura += 1;
      if (mesFatura > 12) {
        mesFatura = 1;
        anoFatura += 1;
      }
    }

    const valorTotalCompra = parseFloat(String(valor));
    const parcelas = parseInt(String(totalParcelas), 10) || 1;
    const valorParcela = parseFloat((valorTotalCompra / parcelas).toFixed(2));

    const despesasCriadas: any[] = [];

    // Cria as parcelas nas faturas correspondentes
    for (let p = 1; p <= parcelas; p++) {
      let m = mesFatura + (p - 1);
      let a = anoFatura;
      while (m > 12) {
        m -= 12;
        a += 1;
      }

      // 1. Encontra ou cria a fatura do mês/ano
      let invoice = await prisma.cardInvoice.findUnique({
        where: {
          cardId_mes_ano: {
            cardId: card.id,
            mes: m,
            ano: a,
          },
        },
      });

      if (!invoice) {
        const dataVenc = new Date(a, m - 1, card.diaVencimento);
        const dataFech = new Date(a, m - 1, card.diaFechamento);

        invoice = await prisma.cardInvoice.create({
          data: {
            cardId: card.id,
            mes: m,
            ano: a,
            dataFechamento: dataFech,
            dataVencimento: dataVenc,
            valorTotal: 0,
            status: "ABERTA",
          },
        });
      }

      // 2. Cria a despesa vinculada à fatura e à categoria de custo
      const d = await prisma.cardExpense.create({
        data: {
          cardId: card.id,
          invoiceId: invoice.id,
          categoryId: categoryId || null,
          dataCompra: dt,
          descricao: parcelas > 1 ? `${descricao} (${p}/${parcelas})` : descricao,
          estabelecimento: estabelecimento || null,
          numeroNf: numeroNf || null,
          valor: valorParcela,
          parcelaAtual: p,
          totalParcelas: parcelas,
          observacoes: observacoes || null,
        },
      });

      // 3. Atualiza o valor total acumulado da fatura
      const novoTotal = invoice.valorTotal + valorParcela;
      await prisma.cardInvoice.update({
        where: { id: invoice.id },
        data: { valorTotal: novoTotal },
      });

      // 4. Se a fatura tiver um Contas a Pagar vinculado, atualiza o valor do título correspondente
      if (invoice.payableId) {
        await prisma.payable.update({
          where: { id: invoice.payableId },
          data: { valorOriginal: novoTotal },
        });
      }

      despesasCriadas.push(d);
    }

    return NextResponse.json({
      success: true,
      message: `${parcelas} parcela(s) lançada(s) com sucesso na composição da fatura do cartão!`,
      items: despesasCriadas,
    });
  } catch (error: any) {
    console.error("Erro ao registrar compra no cartão:", error);
    return NextResponse.json({ error: "Erro ao lançar compra no cartão." }, { status: 500 });
  }
}
